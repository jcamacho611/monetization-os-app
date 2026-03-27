# Local Growth Portal (No-Dependency MVP)

A lightweight, fully local MVP web app for managing small business intake and simple growth portals.

## What this app includes

- **Landing page** with headline, value proposition, pricing cards, and CTA buttons.
- **Intake form** that saves client submissions locally to `data/clients.json`.
- **Admin dashboard** showing all clients (including seeded demo clients).
- **Client detail page** from admin with quick link to each portal.
- **Client portal page** per client with static Top 5 fixes, review templates, and notes.
- **Demo data** preloaded for plumbing, HVAC, and cleaning businesses.

## Tech stack

- Node.js built-in modules only (`http`, `fs`, `path`, `url`)
- HTML + CSS + minimal JavaScript-free form handling
- No frameworks and no package installs required

## Project structure

```txt
.
├── data/
│   └── clients.json      # Local storage (includes demo clients)
├── public/
│   └── styles.css        # App styling
├── server.js             # HTTP server + route handlers
└── README.md
```

## Run locally

### 1) Make sure Node.js is installed

Any modern Node.js version that supports `replaceAll` (Node 16+) should work.

### 2) Start the app

```bash
node server.js
```

### 3) Open in browser

Go to:

- `http://localhost:3000/` (Landing page)
- `http://localhost:3000/intake` (Intake form)
- `http://localhost:3000/admin` (Admin dashboard)

## How data is saved

- Client submissions from the intake form are appended to `data/clients.json`.
- The app reads/writes this file directly on each request.
- To reset data, replace `data/clients.json` with your desired baseline.

## Fast next upgrade step

Add lightweight authentication for the admin area (for example, a basic password gate in front of `/admin`) and convert static portal sections into per-client editable data fields.
