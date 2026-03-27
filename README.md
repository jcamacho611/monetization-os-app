# Zumi MVP

This project is now positioned as a cleaner Apple-style Zumi operator app: an AI website operator for med spas, creator-led brands, clothing businesses, service businesses, and other booking-led companies. It combines site/operator positioning, trust pages, a free-audit funnel, approval-first intake, premium proof assets, Express-based routing, and the original follow-up workflow that is ready for the current OpenAI SDK.

## What is implemented

- Premium landing page with a lighter Apple-style visual system, large typography, clear CTAs, launch metrics, feature cards, and pricing.
- Clearer sales funnel: free audit, first fix plan, and monthly operator plan.
- New About, Privacy, Terms, and Authorization pages to support a safer trust and consent layer.
- Intake flow now feels lighter and easier, with a simpler public audit form and a dedicated success screen.
- Dedicated solutions hub plus multiple offer pages for follow-up AI, missed-call recovery, reviews, reactivation, and done-for-you setup.
- Additional product pages for how it works, discover, verify, convert, and industries.
- Added med-spa expansion pages for a permission-based AI Website Operator, including connector, compliance, and architecture content.
- Broadened industry positioning to include creator-led and clothing brands alongside med spas and booking-led businesses.
- Instant preview flow that demonstrates the opportunity engine before signup.
- Clearer product identity and sales narrative built around missed-call recovery, estimate reactivation, and review generation.
- Brand assets for Zumi, including SVG logo files, favicon, and a lightweight brand brief.
- `Zumi Adapt Engine` that uses business size, lead flow, and sales motion to customize the operating playbook automatically.
- Proof-oriented case study page with illustrative launch scenarios for selling before real customer data exists.
- Intake flow that saves clients to `data/clients.json`.
- Optional Stripe payment-link support for Starter, Operator, and Concierge plans through environment variables.
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

4. Optional: add Stripe payment links if you want plan cards to show `Pay & Start` buttons:

```bash
STRIPE_STARTER_PAYMENT_LINK=https://buy.stripe.com/...
STRIPE_OPERATOR_PAYMENT_LINK=https://buy.stripe.com/...
STRIPE_CONCIERGE_PAYMENT_LINK=https://buy.stripe.com/...
```

5. Start the app:

```bash
npm start
```

5. Open:

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
- `http://localhost:3000/intake/success`
- `http://localhost:3000/admin`

## AI follow-up behavior

- If `OPENAI_API_KEY` is present, the app calls the OpenAI Responses API using the model in `OPENAI_MODEL`.
- If no key is configured, the app returns a local fallback draft so the workflow still functions during development.

## Current limitations

This repo is still using the local JSON store from the original MVP. The broader roadmap items from the executive summary are not implemented yet, including:

- PostgreSQL and Prisma migration
- Authentication and user accounts
- Stripe server-side checkout and webhooks
- Twilio, SendGrid, and Google integrations
- Production deployment setup
