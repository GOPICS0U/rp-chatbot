# RP Chatbot V4

Chatbot RP local avec Next.js, TypeScript, Tailwind, Ollama, SQLite et Prisma.

## Installation

```bash
npm install
npx prisma migrate dev --name v4
npm run dev
```

Ollama :

```bash
ollama pull gemma3:12b
```

Puis ouvre http://localhost:3000.

## V4

- Personnages avancés : background, objectifs, goûts, défauts, règles, lore.
- Conversations persistantes.
- Streaming Ollama et arrêt de génération.
- Température et modèle par personnage.
- Mémoire résumée automatiquement périodiquement.
- Modification, suppression et régénération des messages.
- SQLite/Prisma avec migrations.
