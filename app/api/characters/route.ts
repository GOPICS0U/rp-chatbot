import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const fields = ['name','personality','description','speechStyle','background','goals','likes','flaws','rules','lore'] as const;

function buildImagePrompt(data: Record<string, unknown>) {
  return [
    `Visual identity of ${String(data.name ?? '')}:`,
    String(data.description ?? ''),
    data.personality ? `Overall vibe: ${String(data.personality)}` : '',
    data.likes ? `Lifestyle/preferences that can inform visual scenes: ${String(data.likes)}` : '',
    data.lore ? `World/context: ${String(data.lore)}` : '',
    'Keep this character visually consistent across images: same identity, age, hair, facial features, body proportions and other explicit physical traits from the description. Do not invent a different character.'
  ].filter(Boolean).join(' ');
}
function dataOf(body: any) {
  return Object.fromEntries(fields.map(k => [k, String(body?.[k] ?? '').trim()])) as Record<(typeof fields)[number], string>;
}
export async function GET() { try { return NextResponse.json({ characters: await prisma.character.findMany({ orderBy: { createdAt: 'asc' } }) }); } catch { return NextResponse.json({ error: 'Impossible de lire les personnages.' }, { status: 500 }); } }
export async function POST(request: Request) {
  try { const data = dataOf(await request.json()); if (!data.name || !data.personality || !data.description || !data.speechStyle) return NextResponse.json({ error: 'Nom, personnalité, description et façon de parler sont obligatoires.' }, { status: 400 }); const c = await prisma.character.create({ data: { ...data, imagePrompt: buildImagePrompt(data) } }); return NextResponse.json({ character: c }, { status: 201 }); }
  catch { return NextResponse.json({ error: 'Impossible de créer le personnage.' }, { status: 500 }); }
}
