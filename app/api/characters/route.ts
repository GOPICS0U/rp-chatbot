import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const fields = ['name','personality','description','speechStyle','background','goals','likes','flaws','rules','lore'] as const;
function dataOf(body: any) {
  return Object.fromEntries(fields.map(k => [k, String(body?.[k] ?? '').trim()])) as Record<(typeof fields)[number], string>;
}
export async function GET() { try { return NextResponse.json({ characters: await prisma.character.findMany({ orderBy: { createdAt: 'asc' } }) }); } catch { return NextResponse.json({ error: 'Impossible de lire les personnages.' }, { status: 500 }); } }
export async function POST(request: Request) {
  try { const data = dataOf(await request.json()); if (!data.name || !data.personality || !data.description || !data.speechStyle) return NextResponse.json({ error: 'Nom, personnalité, description et façon de parler sont obligatoires.' }, { status: 400 }); const c = await prisma.character.create({ data }); return NextResponse.json({ character: c }, { status: 201 }); }
  catch { return NextResponse.json({ error: 'Impossible de créer le personnage.' }, { status: 500 }); }
}
