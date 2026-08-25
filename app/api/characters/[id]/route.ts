import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
const fields = ['name','personality','description','speechStyle','background','goals','likes','flaws','rules','lore','model'] as const;
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
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await request.json();
    const current = await prisma.character.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Personnage introuvable.' }, { status: 404 });
    const data: any = {};
    for (const k of fields) if (b[k] !== undefined) data[k] = String(b[k] ?? '').trim();
    if (b.temperature !== undefined) data.temperature = Math.max(0, Math.min(1.5, Number(b.temperature)));
    const merged = { ...current, ...data };
    if (!merged.name || !merged.personality || !merged.description || !merged.speechStyle) return NextResponse.json({ error: 'Nom, personnalité, description et façon de parler sont obligatoires.' }, { status: 400 });
    data.imagePrompt = buildImagePrompt(merged);
    return NextResponse.json({ character: await prisma.character.update({ where: { id }, data }) });
  } catch { return NextResponse.json({ error: 'Impossible de modifier le personnage.' }, { status: 500 }); }
}
export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) { try { await prisma.character.delete({ where: { id: (await params).id } }); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: 'Impossible de supprimer le personnage.' }, { status: 500 }); } }
