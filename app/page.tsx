'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Message = {
  id: string;
  role: string;
  type?: string;
  content: string;
  imageUrl?: string | null;
  imagePrompt?: string | null;
  createdAt: string;
};

type Character = {
  id: string;
  name: string;
  personality: string;
  description: string;
  speechStyle: string;
  background: string;
  goals: string;
  likes: string;
  flaws: string;
  rules: string;
  lore: string;
  imagePrompt: string;
  model: string;
  temperature: number;
  summary: string;
};

type Conversation = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type Form = Omit<Character, 'id' | 'summary' | 'temperature' | 'imagePrompt'> & { temperature: number };

const blank: Form = {
  name: '', personality: '', description: '', speechStyle: '', background: '', goals: '',
  likes: '', flaws: '', rules: '', lore: '', model: 'gemma3:12b', temperature: 0.8,
};

const labels: [keyof Form, string, boolean][] = [
  ['name', 'Nom', false], ['personality', 'Personnalité', true], ['description', 'Description', true],
  ['speechStyle', 'Façon de parler', true], ['background', 'Histoire / background', true],
  ['goals', 'Objectifs', true], ['likes', 'Goûts / préférences', true], ['flaws', 'Défauts', true],
  ['rules', 'Règles de comportement', true], ['lore', 'Lore / contexte', true],
];

export default function Home() {
  const [chars, setChars] = useState<Character[]>([]);
  const [char, setChar] = useState<Character | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [imageModal, setImageModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageShape, setImageShape] = useState<'portrait' | 'square' | 'landscape'>('portrait');
  const [form, setForm] = useState<Form>(blank);
  const [temp, setTemp] = useState(0.8);
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChars(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function json(url: string, opt?: RequestInit) {
    const r = await fetch(url, opt);
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'Erreur');
    return d;
  }

  async function loadChars() {
    try {
      const d = await json('/api/characters');
      setChars(d.characters);
      if (d.characters[0]) await selectChar(d.characters[0].id);
      else setModal('create');
    } catch (e) { setError(String(e)); }
  }

  async function selectChar(id: string) {
    try {
      const list = (chars.length ? chars : (await json('/api/characters')).characters) as Character[];
      const c = list.find((x) => x.id === id);
      if (!c) throw Error('Personnage introuvable.');
      setChar(c); setTemp(c.temperature); setMsgs([]); setConv(null); setError('');
      const d = await json(`/api/conversations?characterId=${id}`);
      setConvs(d.conversations);
      if (d.conversations[0]) await selectConv(d.conversations[0].id, id);
      else await newConv(id, true);
    } catch (e) { setError(String(e)); }
  }

  async function selectConv(id: string, idChar = char?.id) {
    if (!idChar) return;
    try {
      const d = await json(`/api/chat?characterId=${idChar}&conversationId=${id}`);
      setConv(d.conversation); setMsgs(d.messages); setError(''); setEditingMsg(null);
    } catch (e) { setError(String(e)); }
  }

  async function newConv(idChar = char?.id, silent = false) {
    if (!idChar || creatingConv) return;
    if (convs.length >= 5) {
      setError('Maximum de 5 conversations atteint pour ce personnage. Supprime-en une pour en créer une nouvelle.');
      return;
    }
    setCreatingConv(true);
    try {
      const d = await json('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: idChar }),
      });
      setConvs((x) => [d.conversation, ...x].slice(0, 5));
      setConv(d.conversation); setMsgs([]); setEditingMsg(null);
      if (!silent) setError('');
    } catch (e) { setError(String(e)); }
    finally { setCreatingConv(false); }
  }

  function openCreate() { setForm(blank); setModal('create'); }
  function openEdit() { if (char) { setForm({ ...char }); setModal('edit'); } }
  function openImage() { setImagePrompt(''); setImageShape('portrait'); setImageModal(true); }

  async function saveChar(e: FormEvent) {
    e.preventDefault();
    try {
      const isCreate = modal === 'create';
      const d = await json(isCreate ? '/api/characters' : `/api/characters/${char!.id}`, {
        method: isCreate ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (isCreate) { setChars((x) => [...x, d.character]); setModal(null); await selectChar(d.character.id); }
      else { setChar(d.character); setTemp(d.character.temperature); setChars((x) => x.map((c) => c.id === d.character.id ? d.character : c)); setModal(null); }
    } catch (e) { setError(String(e)); }
  }

  async function deleteChar() {
    if (!char || !confirm(`Supprimer ${char.name} et ses conversations ?`)) return;
    await json(`/api/characters/${char.id}`, { method: 'DELETE' });
    const left = chars.filter((c) => c.id !== char.id);
    setChar(null); setConv(null); setMsgs([]); setConvs([]); setChars(left);
    if (left[0]) await selectChar(left[0].id); else setModal('create');
  }

  async function deleteConv(id = conv?.id) {
    if (!id || !confirm('Supprimer cette conversation ?')) return;
    await json(`/api/conversations/${id}`, { method: 'DELETE' });
    const d = await json(`/api/conversations?characterId=${char!.id}`);
    setConvs(d.conversations);
    if (d.conversations[0]) await selectConv(d.conversations[0].id);
    else await newConv(char!.id, true);
  }

  async function send(e: FormEvent, regenId?: string) {
    e.preventDefault();
    if (busy || imageBusy || !char || !conv) return;
    const content = regenId
      ? (msgs.slice(0, msgs.findIndex((m) => m.id === regenId)).reverse().find((m) => m.role === 'user')?.content || '')
      : input.trim();
    if (!regenId && !content) return;

    // [photo] is a local chat command: it never reaches Ollama.
    if (!regenId && /^\[photo\]/i.test(content)) {
      const photoPrompt = content.replace(/^\[photo\]\s*/i, '').trim();
      setInput('');
      if (!photoPrompt) {
        openImage();
        return;
      }
      await generateImagePrompt(photoPrompt, 'portrait');
      return;
    }

    setInput(''); setError(''); setBusy(true);
    const tempMsgs = msgs.filter((m) => !regenId || m.id !== regenId);
    if (!regenId) tempMsgs.push({ id: crypto.randomUUID(), role: 'user', type: 'text', content, createdAt: new Date().toISOString() });
    tempMsgs.push({ id: crypto.randomUUID(), role: 'assistant', type: 'text', content: '', createdAt: new Date().toISOString() });
    setMsgs(tempMsgs);

    const controller = new AbortController(); abort.current = controller;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, characterId: char.id, conversationId: conv.id, temperature: temp, regenerateAssistantId: regenId }),
        signal: controller.signal,
      });
      if (!r.ok) { const d = await r.json(); throw Error(d.error || 'Erreur de chat'); }
      const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = ''; let full = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const parts = buf.split('\n\n'); buf = parts.pop() || '';
        for (const p of parts) {
          if (!p.startsWith('data: ')) continue;
          const d = JSON.parse(p.slice(6));
          if (d.error) throw Error(d.error);
          if (d.text) { full += d.text; setMsgs((m) => m.map((x, i) => i === m.length - 1 ? { ...x, content: full } : x)); }
          if (d.done) {
            setMsgs((m) => m.map((x) => x.id === m[m.length - 1].id ? d.message : x));
            const title = conv.title === 'Nouvelle conversation' ? content.slice(0, 48) : conv.title;
            setConv((c) => c ? { ...c, title, updatedAt: new Date().toISOString() } : c);
            setConvs((list) => list.map((x) => x.id === conv.id ? { ...x, title, updatedAt: new Date().toISOString() } : x));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { setError(String(e)); setMsgs((m) => m.slice(0, -1)); }
    } finally { abort.current = null; setBusy(false); }
  }

  async function generateImagePrompt(prompt: string, shape: 'portrait' | 'square' | 'landscape') {
    if (imageBusy || busy || !char || !conv || !prompt.trim()) return;
    setImageBusy(true); setError('');
    try {
      const d = await json('/api/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), shape, characterId: char.id, conversationId: conv.id }),
      });
      setMsgs((m) => [...m, d.message]); setImageModal(false); setImagePrompt('');
      setConvs((list) => list.map((x) => x.id === conv.id ? { ...x, updatedAt: new Date().toISOString() } : x));
      setConv((c) => c ? { ...c, updatedAt: new Date().toISOString() } : c);
    } catch (e) { setError(String(e)); }
    finally { setImageBusy(false); }
  }

  async function generateImage(e: FormEvent) {
    e.preventDefault();
    await generateImagePrompt(imagePrompt, imageShape);
  }

  async function editMessage(id: string) {
    try {
      const d = await json(`/api/messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editText }) });
      setMsgs((m) => m.map((x) => x.id === id ? d.message : x)); setEditingMsg(null);
    } catch (e) { setError(String(e)); }
  }

  async function deleteMsg(id: string) {
    if (!confirm('Supprimer ce message ?')) return;
    await json(`/api/messages/${id}`, { method: 'DELETE' });
    setMsgs((m) => m.filter((x) => x.id !== id));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] gap-3 p-3 text-zinc-100 md:p-5">
      <aside className="hidden w-80 shrink-0 space-y-3 md:block">
        <Panel title="Personnages" action={<button onClick={openCreate} className="rounded-lg bg-white px-3 py-1 text-black">+</button>}>
          {chars.map((c) => (
            <button key={c.id} onClick={() => selectChar(c.id)} className={`mb-1 w-full rounded-xl p-3 text-left ${char?.id === c.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}>
              <b>{c.name}</b><div className="truncate text-xs text-zinc-500">{c.description}</div>
            </button>
          ))}
        </Panel>

        {char && (
          <Panel title={`Conversations (${convs.length}/5)`} action={<button onClick={() => newConv()} disabled={convs.length >= 5 || creatingConv} className="rounded-lg bg-white px-3 py-1 text-black disabled:cursor-not-allowed disabled:opacity-40">+</button>}>
            {convs.map((c) => (
              <div key={c.id} className={`group mb-1 flex items-center rounded-xl ${conv?.id === c.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}>
                <button onClick={() => selectConv(c.id)} className="min-w-0 flex-1 truncate p-3 text-left text-sm">{c.title}</button>
                <button onClick={() => deleteConv(c.id)} className="px-3 text-red-400 opacity-0 group-hover:opacity-100">×</button>
              </div>
            ))}
          </Panel>
        )}
      </aside>

      <section className="flex min-h-[calc(100vh-1.5rem)] min-w-0 flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-950">
        <header className="border-b border-zinc-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><h1 className="truncate text-xl font-bold">{char?.name || 'RP Chatbot'}</h1><p className="truncate text-sm text-zinc-500">{conv?.title || char?.description || 'Crée ton premier personnage.'}</p></div>
            {char && <div className="flex gap-2"><button onClick={openEdit} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">Modifier</button><button onClick={deleteChar} className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-400">Supprimer</button></div>}
          </div>
          <div className="mt-3 flex gap-2 md:hidden">
            <select value={char?.id || ''} onChange={(e) => selectChar(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 p-2">{chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button onClick={openCreate} className="rounded-xl bg-white px-4 text-black">+</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-7">
          {msgs.length === 0 && <div className="mx-auto max-w-xl py-24 text-center"><div className="mb-3 text-4xl">🎭</div><h2 className="text-lg font-semibold">Nouvelle scène</h2><p className="mt-2 text-sm text-zinc-500">Commence une conversation avec {char?.name || 'ton personnage'}.</p></div>}
          {msgs.map((m, i) => {
            const isImage = m.type === 'image' || m.role === 'image';
            return (
              <div key={m.id} className={`group mb-5 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[90%]">
                  {isImage ? (
                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                      {m.imageUrl ? <img src={m.imageUrl} alt={m.imagePrompt || 'Image générée'} className="max-h-[620px] w-auto max-w-full" /> : <div className="p-4 text-sm text-zinc-400">Image indisponible.</div>}
                      <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">📷 {m.imagePrompt}</div>
                    </div>
                  ) : (
                    <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                      {editingMsg === m.id ? <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-w-[300px] bg-transparent outline-none" /> : (m.content || (busy ? '…' : ''))}
                    </div>
                  )}

                  {!busy && !imageBusy && !isImage && (
                    <div className={`mt-1 flex gap-2 text-[11px] text-zinc-600 opacity-0 group-hover:opacity-100 ${m.role === 'user' ? 'justify-end' : ''}`}>
                      {editingMsg === m.id ? <><button onClick={() => editMessage(m.id)}>sauver</button><button onClick={() => setEditingMsg(null)}>annuler</button></> : <>
                        <button onClick={() => { setEditingMsg(m.id); setEditText(m.content); }}>modifier</button>
                        <button onClick={() => deleteMsg(m.id)}>supprimer</button>
                        {m.role === 'assistant' && i === msgs.length - 1 && <button onClick={() => send({ preventDefault: () => {} } as FormEvent, m.id)}>régénérer</button>}
                      </>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        {error && <div className="border-t border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">{error}</div>}

        <div className="border-t border-zinc-800 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500"><span>Ollama · {char?.model || 'gemma3:12b'}</span>{busy ? <button onClick={() => abort.current?.abort()} className="text-red-400">Arrêter</button> : <span>Temp. {(temp ?? 0.8).toFixed(1)}</span>}</div>
          <form onSubmit={send} className="flex gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} disabled={busy || imageBusy || !char || !conv} placeholder="Écris un message…" rows={2} className="min-w-0 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 outline-none" />
            <button type="button" onClick={openImage} disabled={busy || imageBusy || !char || !conv} title="Générer une image" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-lg disabled:opacity-40">📷</button>
            <button disabled={busy || imageBusy || !input.trim() || !char || !conv} className="rounded-xl bg-white px-5 font-semibold text-black disabled:opacity-40">Envoyer</button>
          </form>
        </div>
      </section>

      {imageModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={generateImage} className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">📷 Générer une image</h2><p className="text-xs text-zinc-500">Perchance · génération gratuite</p></div><button type="button" onClick={() => setImageModal(false)}>✕</button></div>
            <label className="block"><span className="mb-2 block text-sm text-zinc-400">Décris l'image</span><textarea autoFocus required value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder={`Ex. ${char?.name || 'le personnage'} dans un café le soir, photographie cinématographique…`} rows={5} className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 outline-none" /></label>
            <label className="block"><span className="mb-2 block text-sm text-zinc-400">Format</span><select value={imageShape} onChange={(e) => setImageShape(e.target.value as typeof imageShape)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3"><option value="portrait">Portrait</option><option value="square">Carré</option><option value="landscape">Paysage</option></select></label>
            <button disabled={imageBusy || !imagePrompt.trim()} className="w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-40">{imageBusy ? 'Génération en cours…' : 'Générer'}</button>
          </form>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-black/80 p-4">
          <form onSubmit={saveChar} className="mx-auto my-6 max-w-3xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex justify-between"><div><h2 className="text-xl font-bold">{modal === 'create' ? 'Créer un personnage' : 'Modifier le personnage'}</h2><p className="text-xs text-zinc-500">Les champs avancés enrichissent le system prompt. L’identité visuelle est générée automatiquement à partir du personnage.</p></div><button type="button" onClick={() => setModal(null)}>✕</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              {labels.map(([k, l, area]) => <label key={k} className={k === 'name' ? 'md:col-span-2' : ''}><span className="mb-1 block text-xs text-zinc-400">{l}</span>{area ? <textarea rows={3} value={form[k] as string} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3" /> : <input required value={form[k] as string} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3" />}</label>)}
              <label><span className="mb-1 block text-xs text-zinc-400">Modèle Ollama</span><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3" /></label>
              <label><span className="mb-1 block text-xs text-zinc-400">Température : {form.temperature.toFixed(1)}</span><input type="range" min="0" max="1.5" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} className="w-full" /></label>
            </div>
            <button className="w-full rounded-xl bg-white py-3 font-semibold text-black">{modal === 'create' ? 'Créer' : 'Enregistrer'}</button>
          </form>
        </div>
      )}
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3"><div className="mb-2 flex items-center justify-between"><b>{title}</b>{action}</div>{children}</div>;
}
