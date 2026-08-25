import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const characterId = new URL(request.url).searchParams.get('characterId');
    if (!characterId) return NextResponse.json({ error: 'characterId requis.' }, { status: 400 });
    const conversations = await prisma.conversation.findMany({ where: { characterId }, orderBy: { updatedAt: 'desc' } });
    return NextResponse.json({ conversations });
  } catch { return NextResponse.json({ error: 'Impossible de lire les conversations.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const characterId = String(body?.characterId ?? '').trim();
    const title = String(body?.title ?? 'Nouvelle conversation').trim() || 'Nouvelle conversation';
    if (!characterId) return NextResponse.json({ error: 'characterId requis.' }, { status: 400 });
    const character = await prisma.character.findUnique({ where: { id: characterId }, select: { id: true } });
    if (!character) return NextResponse.json({ error: 'Personnage introuvable.' }, { status: 404 });
    const count = await prisma.conversation.count({ where: { characterId } });
    if (count >= 5) return NextResponse.json({ error: 'Ce personnage a déjà 5 conversations. Supprime-en une pour en créer une nouvelle.' }, { status: 409 });
    const conversation = await prisma.conversation.create({ data: { characterId, title } });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Impossible de créer la conversation.' }, { status: 500 }); }
}
