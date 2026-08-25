# RP Chatbot V6

Chatbot RP local avec Next.js, Ollama, SQLite + Prisma et génération d'images Perchance.

## Installation

```bash
npm install
npx prisma migrate dev --name v6_4_character_image_prompt --name v6
npm run dev
```

Configure `.env` :

```env
DATABASE_URL="file:./dev.db"
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="gemma3:12b"
```

Ollama doit être lancé localement et le modèle choisi doit être installé.

## Images

Le bouton 📷 permet de demander manuellement une image dans une conversation. L'image est générée via Perchance puis sauvegardée localement dans `public/generated/` et enregistrée comme message de la conversation.

### Perchance — images

La génération Perchance utilise Chromium via Playwright pour effectuer la vérification côté navigateur.
Après `npm install`, installe le navigateur une fois :

```bash
npx playwright install chromium
```

### Images
- 📷 opens the image generator.
- Typing `[photo]` at the start of a message triggers image generation; everything after `[photo]` is used as the scene prompt.
- A hidden visual prefix automatically adds the character description and a consistent anime-art style.


## V6.4

La génération d’image utilise une identité visuelle propre à chaque personnage, construite automatiquement depuis sa fiche. Le prompt de scène utilisateur est ensuite ajouté explicitement pour préserver les actions et objets demandés.
