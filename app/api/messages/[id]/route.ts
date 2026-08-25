import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const content = String((await request.json())?.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'Message vide.' }, { status: 400 });
    const m = await prisma.message.update({ where: { id }, data: { content } });
    return NextResponse.json({ message: m });
  } catch {
    return NextResponse.json({ error: 'Impossible de modifier le message.' }, { status: 500 });
  }
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const m = await prisma.message.findUnique({ where: { id }, select: { imageUrl: true } });
    await prisma.message.delete({ where: { id } });
    if (m?.imageUrl?.startsWith('/generated/')) {
      try { await unlink(path.join(process.cwd(), 'public', m.imageUrl)); } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Impossible de supprimer le message.' }, { status: 500 });
  }
}
