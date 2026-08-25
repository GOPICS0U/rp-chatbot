import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { chromium } from 'playwright';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERCHANCE = 'https://image-generation.perchance.org';
const RESOLUTIONS = { square: '768x768', portrait: '512x768', landscape: '768x512' } as const;
type Shape = keyof typeof RESOLUTIONS;

async function generateWithPerchance(prompt: string, shape: Shape, negativePrompt: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    const page = await context.newPage();
    const verify = await page.goto(`${PERCHANCE}/api/verifyUser?thread=0`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!verify || !verify.ok()) throw new Error(`Perchance verification (${verify?.status() ?? 'no response'})`);

    const verifyText = await page.textContent('body');
    const match = verifyText?.match(/"userKey"\s*:\s*"([^"]+)"/);
    if (!match) throw new Error('Perchance n’a pas fourni de clé utilisateur.');
    const userKey = match[1];
    const requestId = `aiImageCompletion${Math.floor(Math.random() * 2 ** 30)}`;
    const cacheBust = Math.random();
    const resolution = RESOLUTIONS[shape];

    const result = await page.evaluate(async ({ userKey, requestId, cacheBust, prompt, negativePrompt, resolution }) => {
      const url = new URL('https://image-generation.perchance.org/api/generate');
      url.searchParams.set('userKey', userKey);
      url.searchParams.set('requestId', requestId);
      url.searchParams.set('__cacheBust', String(cacheBust));
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ generatorName: 'ai-image-generator', channel: 'ai-text-to-image-generator', subChannel: 'public', prompt, negativePrompt, seed: -1, resolution, guidanceScale: 7 }),
      });
      const text = await response.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}
      return { ok: response.ok, status: response.status, data, text: text.slice(0, 1000) };
    }, { userKey, requestId, cacheBust, prompt, negativePrompt, resolution });

    if (!result.ok || !result.data?.imageDownloadUrl) throw new Error(`Perchance génération (${result.status})${result.text ? `: ${result.text}` : ''}`);

    const imageUrl = new URL(result.data.imageDownloadUrl, PERCHANCE).toString();
    const download = await page.evaluate(async (url) => {
      const r = await fetch(url);
      if (!r.ok) return { ok: false, status: r.status, bytes: null };
      return { ok: true, status: r.status, bytes: Array.from(new Uint8Array(await r.arrayBuffer())) };
    }, imageUrl);
    if (!download.ok || !download.bytes) throw new Error(`Téléchargement Perchance (${download.status})`);

    return { bytes: Buffer.from(download.bytes), extension: String(result.data.fileExtension || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg' };
  } finally {
    await browser.close();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt ?? '').trim();
    const characterId = String(body?.characterId ?? '').trim();
    const conversationId = String(body?.conversationId ?? '').trim();
    const shape: Shape = ['square', 'portrait', 'landscape'].includes(body?.shape) ? body.shape : 'portrait';
    if (!prompt) return NextResponse.json({ error: 'Prompt image requis.' }, { status: 400 });
    if (!characterId || !conversationId) return NextResponse.json({ error: 'Conversation requise.' }, { status: 400 });
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.characterId !== characterId) return NextResponse.json({ error: 'Conversation invalide.' }, { status: 400 });

    const character = await prisma.character.findUnique({ where: { id: characterId } });
    if (!character) return NextResponse.json({ error: 'Personnage introuvable.' }, { status: 404 });

    // Per-character invisible visual identity. Older characters get a safe fallback.
    const characterVisualPrompt = character.imagePrompt?.trim() || [
      `Visual identity of ${character.name}:`,
      character.description,
      character.personality ? `Overall vibe: ${character.personality}` : '',
      character.likes ? `Lifestyle/preferences: ${character.likes}` : '',
      character.lore ? `World/context: ${character.lore}` : '',
    ].filter(Boolean).join(' ');

    // The user's scene is deliberately explicit so the generator does not turn every request into a generic portrait.
    const basePrompt = [
      'Photorealistic casual lifestyle photography. Real human appearance, natural skin texture, realistic facial proportions, natural hair, believable lighting and real-world materials. Candid everyday photography, not a studio beauty portrait.',
      characterVisualPrompt,
      `SCENE ACTION — The character MUST be visibly and unmistakably performing this exact requested action: ${prompt}.`,
      `Make the requested action and any requested object clearly visible and physically present in the image. Do not replace the scene with a generic portrait. Composition should prioritize the requested action.`,
    ].filter(Boolean).join(' ');

    const negativePrompt = 'anime, manga, cartoon, illustration, digital art, 2D, cel shading, lineart, oversized eyes, anime eyes, doll face, plastic skin, exaggerated facial features, fantasy character art, CGI, 3D render, videogame art, generic portrait, headshot, empty hands when an object is requested, missing requested object, ignoring the requested action, text, watermark';

    const generated = await generateWithPerchance(basePrompt, shape, negativePrompt);
    const filename = `${crypto.randomUUID()}.${generated.extension}`;
    const dir = path.join(process.cwd(), 'public', 'generated');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), generated.bytes);
    const message = await prisma.message.create({ data: { role: 'image', type: 'image', content: prompt, imageUrl: `/generated/${filename}`, imagePrompt: prompt, characterId, conversationId } });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de génération d’image.';
    return NextResponse.json({ error: `Génération d’image impossible : ${message}` }, { status: 502 });
  }
}
