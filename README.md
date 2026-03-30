# Jeni Phase 1

Jeni is a premium **trust scan** product built on the existing Express/CommonJS app. It reads a signal-rich source, maps the trust layer, and returns a live audit around proof, risk, revenue direction, and the strongest receipt opportunity.

## What is implemented

- Premium public site with a simpler, more AI-native Jeni landing experience
- Instant trust-scan flow:
  - type anything or paste a link on the homepage
  - loose domains like `example.com` normalize automatically
  - create lead + audit job
  - redirect to `/audit/:id`
  - poll live progress
  - render real results automatically
- Storage adapter:
  - JSON fallback for local development
  - Postgres support when `DATABASE_URL` is configured
- URL scanning pipeline:
  - homepage first
  - same-origin page discovery
  - HTML parsing with Cheerio
  - structured page summaries saved per scan
- Structured trust-scan generation with OpenAI Responses API plus heuristic fallback when OpenAI is unavailable
- Trust scans include:
  - overall score
  - five-second read
  - need / trust / revenue / receipt depth / platform potential / launch speed scores
  - top findings
  - quick wins
  - trust positioning
  - receipt directions
  - revenue-path recommendations
  - verifier-layer recommendations
- Admin dashboard still surfaces scan status, score, call queue, and latest scan links
- Messaging center supports:
  - inquiry follow-up
  - missed-call recovery
  - reactivation
  - review request
  - consult nudge
  - booking reminder

## Tech stack

- Node.js
- Express
- OpenAI Node SDK
- PostgreSQL via `pg`
- Cheerio
- Dotenv
- Server-rendered HTML, CSS, and small browser-side JavaScript

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Add your OpenAI API key if you want live AI-generated follow-ups and trust scans:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_AUDIT_MODEL=gpt-4.1
AUDIT_MAX_PAGES=5
AUDIT_FETCH_TIMEOUT_MS=10000
```

4. Optional: connect Postgres for production-minded storage.

```bash
DATABASE_URL=postgres://...
```

If `DATABASE_URL` is present, Jeni uses Postgres. If not, it falls back to the local JSON files in `data/`.

5. Optional: initialize Postgres tables:

```bash
npm run db:init
```

6. Start the app:

```bash
npm start
```

7. Open:

- `http://localhost:3000/`
- `http://localhost:3000/intake`
- `http://localhost:3000/audit/:id`
- `http://localhost:3000/shield`
- `http://localhost:3000/case-studies`
- `http://localhost:3000/how-it-works`
- `http://localhost:3000/about`
- `http://localhost:3000/admin`

## Key routes

- `POST /api/intake`
- `GET /audit/:id`
- `GET /api/audit/:id`
- `POST /api/followup/:id`
- `GET /health`

## Current limitations

- No authentication or user accounts yet
- No deeper external connectors beyond source scanning
- No Stripe server-side checkout or webhooks yet
- No Twilio, email delivery, or social API automations yet
- Audit jobs still run in-process; there is no external queue worker yet
