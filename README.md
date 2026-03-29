# Zumi Phase 1

Zumi is now a Phase 1 **AI Revenue Operator** for booking-based businesses. It keeps the existing Express/CommonJS architecture, but adds a real website-audit job flow, a premium instant-audit experience, a storage adapter with Postgres support, and a more intentional operator surface around messaging, fixes, and lead handling.

## What is implemented

- Premium public site with a cinematic entry experience and conversion-first positioning.
- Instant audit flow:
  - submit website
  - create lead + audit job
  - redirect to `/audit/:id`
  - poll live progress
  - render real results automatically
- Storage adapter:
  - JSON fallback for local development
  - Postgres support when `DATABASE_URL` is configured
- Website scanning pipeline:
  - homepage first
  - same-origin page discovery
  - HTML parsing with Cheerio
  - structured page summaries saved per audit
- Structured audit generation with OpenAI Responses API plus heuristic fallback when OpenAI is unavailable.
- Audit results include scores, quick wins, leaks, rewritten hero copy, trust recommendations, booking-flow recommendations, and approval-first fix direction.
- Admin dashboard now surfaces audit status, audit score, call queue, and latest audit links.
- Messaging center now supports multiple message types:
  - inquiry follow-up
  - missed-call recovery
  - reactivation
  - review request
  - consult nudge
  - booking reminder
- Fix Center is now represented in the audit and admin experience as draft recommendations prepared for approval-first execution.
- Existing routes and follow-up workflows are preserved.

## Tech stack

- Node.js
- Express
- OpenAI Node SDK
- PostgreSQL via `pg`
- Cheerio
- Dotenv
- Server-rendered HTML, CSS, and small browser-side JavaScript

## Project structure

```txt
.
├── data/
│   ├── audits.json
│   └── clients.json
├── lib/
│   ├── audit-prompts.js
│   ├── audit-runner.js
│   ├── site-fetcher.js
│   ├── site-parser.js
│   ├── storage-json.js
│   ├── storage-postgres.js
│   └── storage.js
├── public/
│   ├── app.js
│   ├── favicon.svg
│   ├── logo-mark.svg
│   ├── logo.svg
│   └── styles.css
├── scripts/
│   └── init-db.js
├── sql/
│   └── init.sql
├── .env.example
├── BRAND.md
├── package.json
├── README.md
└── server.js
```

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env` if you want live AI-generated follow-ups and audits.

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

If `DATABASE_URL` is present, Zumi uses Postgres. If not, it falls back to the local JSON files in `data/`.

5. Optional: initialize Postgres tables:

```bash
npm run db:init
```

6. Optional: add Stripe payment links if you want plan cards to show `Pay & Start` buttons:

```bash
STRIPE_STARTER_PAYMENT_LINK=https://buy.stripe.com/...
STRIPE_OPERATOR_PAYMENT_LINK=https://buy.stripe.com/...
STRIPE_CONCIERGE_PAYMENT_LINK=https://buy.stripe.com/...
```

7. Start the app:

```bash
npm start
```

8. Open:

- `http://localhost:3000/`
- `http://localhost:3000/case-studies`
- `http://localhost:3000/about`
- `http://localhost:3000/privacy`
- `http://localhost:3000/terms`
- `http://localhost:3000/authorization`
- `http://localhost:3000/how-it-works`
- `http://localhost:3000/discover`
- `http://localhost:3000/verify`
- `http://localhost:3000/convert`
- `http://localhost:3000/industries`
- `http://localhost:3000/med-spas`
- `http://localhost:3000/operator-architecture`
- `http://localhost:3000/solutions`
- `http://localhost:3000/pricing`
- `http://localhost:3000/intake`
- `http://localhost:3000/audit/:id`
- `http://localhost:3000/admin`

## Key routes

- `POST /api/intake`
- `GET /audit/:id`
- `GET /api/audit/:id`
- `POST /api/followup/:id`
- `GET /api/blueprint/:id`
- `GET /health`

## Audit behavior

- If `OPENAI_API_KEY` is present, Zumi uses the OpenAI Responses API to generate a structured website audit.
- If the OpenAI request fails, or no key is configured, Zumi falls back to a heuristic audit so the customer still gets a useful result.
- Audit jobs store:
  - audit status
  - parsed page summaries
  - structured result output
  - source mode (`openai` or heuristic fallback)

## AI follow-up behavior

- If `OPENAI_API_KEY` is present, the app calls the OpenAI Responses API using the model in `OPENAI_MODEL`.
- If no key is configured, the app returns a local fallback draft so the workflow still functions during development.

## Current limitations

Phase 1 is now significantly stronger than the original MVP, but a few future layers are still open:

- No authentication or user accounts yet
- No external site-builder publishing integrations yet
- No Stripe server-side checkout or webhooks yet
- No Twilio, email delivery, or social API automations yet
- Audit jobs run in-process; there is no external queue worker yet
