# Local Growth Portal (Polished Local MVP)

A no-dependency Node.js app for local business intake, admin workflow, private client portals, and AI-assisted follow-up drafting.

## What's improved in this revision

- Premium dark-mode UI with larger typography, stronger CTA hierarchy, and responsive cards.
- Basic admin authentication (`/login`) with cookie-based sessions.
- Searchable admin dashboard.
- Per-client private portal tokens (`/portal/:token`).
- AI follow-up generation endpoint (`POST /api/followup`) with automatic fallback template when no OpenAI key is configured.

## Stack

- Built-in Node.js modules only (`http`, `fs`, `url`, `crypto`, `https`)
- HTML + CSS + minimal browser JavaScript
- No npm install required

## Project structure

```txt
.
├── data/
│   └── clients.json
├── public/
│   ├── app.js
│   └── styles.css
├── .env.example
├── README.md
└── server.js
```

## Run locally

1. Optional: copy env defaults

```bash
cp .env.example .env
```

2. Start server

```bash
ADMIN_PASSWORD=change-me node server.js
```

3. Open browser

- `http://localhost:3000/` landing page
- `http://localhost:3000/login` admin sign in
- `http://localhost:3000/admin` dashboard (requires login)

### Default login

- Username: `admin`
- Password: `change-me`

You should override these using environment variables in real usage.

## AI follow-up behavior

- Click **Generate AI Follow-up** on a client detail page.
- If `OPENAI_API_KEY` is present, the app calls `POST https://api.openai.com/v1/responses`.
- If no key is set (or API fails), the app returns a useful local fallback message.

## Next upgrade step

Move session and client data from in-memory/JSON to a database (PostgreSQL or SQLite) so authentication and records persist safely across process restarts and multi-user usage.
