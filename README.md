# Zumi MVP

This project is the upgraded first milestone from the executive summary: a premium dark-mode Zumi app for local service businesses with stronger positioning, an automatic customization engine, sales-ready proof assets, Express-based routing, and an AI follow-up workflow that is ready for the current OpenAI SDK.

## What is implemented

- Premium landing page with large typography, bold CTAs, launch metrics, feature cards, and pricing.
- Dedicated solutions hub plus multiple offer pages for follow-up AI, missed-call recovery, reviews, reactivation, and done-for-you setup.
- Additional product pages for how it works, discover, verify, convert, and industries.
- Added med-spa expansion pages for a permission-based AI Website Operator, including connector, compliance, and architecture content.
- Instant preview flow that demonstrates the opportunity engine before signup.
- Clearer product identity and sales narrative built around missed-call recovery, estimate reactivation, and review generation.
- Brand assets for Zumi, including SVG logo files, favicon, and a lightweight brand brief.
- `Zumi Adapt Engine` that uses business size, lead flow, and sales motion to customize the operating playbook automatically.
- Proof-oriented case study page with illustrative launch scenarios for selling before real customer data exists.
- Intake flow that saves clients to `data/clients.json`.
- Admin dashboard with summary metrics and client management entry points.
- Client detail screen with an AI follow-up generator for email, SMS, and WhatsApp-style drafts.
- Private client portal view with weekly focus areas, review prompts, and a custom sequence plan.
- Graceful fallback follow-up generation when `OPENAI_API_KEY` is not configured.
- Blueprint endpoint at `GET /api/blueprint/:id`.
- Health endpoint at `GET /health`.

## Tech stack

- Node.js
- Express
- OpenAI Node SDK
- Dotenv
- Server-rendered HTML, CSS, and small browser-side JavaScript

## Project structure

```txt
.
├── data/
│   └── clients.json
├── public/
│   ├── app.js
│   ├── favicon.svg
│   ├── logo-mark.svg
│   ├── logo.svg
│   └── styles.css
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

3. Add your OpenAI API key to `.env` if you want live AI-generated follow-ups.

4. Start the app:

```bash
npm start
```

5. Open:

- `http://localhost:3000/`
- `http://localhost:3000/case-studies`
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
- `http://localhost:3000/admin`

## AI follow-up behavior

- If `OPENAI_API_KEY` is present, the app calls the OpenAI Responses API using the model in `OPENAI_MODEL`.
- If no key is configured, the app returns a local fallback draft so the workflow still functions during development.

## Current limitations

This repo is still using the local JSON store from the original MVP. The broader roadmap items from the executive summary are not implemented yet, including:

- PostgreSQL and Prisma migration
- Authentication and user accounts
- Stripe billing and webhooks
- Twilio, SendGrid, and Google integrations
- Production deployment setup
