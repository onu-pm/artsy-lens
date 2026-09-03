ArtsyLens is an AI tour guide for people standing in front of something old and beautiful with no idea what they are looking at.

Google Maps gets you to the monument, then stops. ArtsyLens picks up from there: it generates a walking tour, lets each checkpoint become its own chat, analyzes photos of carvings or architectural details, and turns the visit into a personal journal.

Local setup
-----------

1. Create a local `.env` file in the project root (this file is ignored by git).

Example `.env` contents:

```bash
OPENROUTER_API_KEY=sk-or-REPLACE_WITH_YOUR_KEY
GEMINI_API_KEY=REPLACE_WITH_YOUR_KEY
```

2. Run the development server:

```bash
npm install
npm run dev
```

