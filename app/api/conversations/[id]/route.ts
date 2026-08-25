import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({ where: { id }, include: { character: true, messages: { orderBy: { createdAt: 'asc' } } } });
    if (!conversation) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch { return NextResponse.json({ error: 'Impossible de lire la conversation.' }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const title = String(body?.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'Titre vide.' }, { status: 400 });
    const conversation = await prisma.conversation.update({ where: { id }, data: { title } });
    return NextResponse.json({ conversation });
  } catch { return NextResponse.json({ error: 'Impossible de modifier la conversation.' }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.conversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Impossible de supprimer la conversation.' }, { status: 500 }); }
}
