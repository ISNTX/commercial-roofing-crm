# Commercial Roofing CRM

Texas commercial roofing lead-gen platform: a daily scraper covers all 254
Texas counties, a FastAPI service serves the leads over REST, and a
Vite/React dashboard lets the team browse and filter them.

## Stack

- **Frontend** (`apps/frontend`): Vite + React + TypeScript + Tailwind, a
  TanStack Table leads dashboard with county/project-type/status filters.
- **Backend** (`apps/backend`): FastAPI, reads/writes Supabase with the
  service-role key, exposes `/health` and `/leads`.
- **Scraper** (`apps/scraper`): Node/Express service. `/run` is triggered
  daily by Supabase `pg_cron` + `pg_net`; iterates all 254 counties with
  bounded concurrency and forwards captured leads to the central outreach
  engine.
- **Database** (`supabase/migrations`): Postgres schema for counties,
  contractors, leads, and scrape run history, with RLS enabled on every
  table (`authenticated` can read; only the service role writes).

Each of the three apps deploys as its own Railway service from this one
repo (`apps/*/railway.json`, Root Directory set per-service in the Railway
dashboard).

## Local development

Each app reads its own `.env` — copy the relevant variables out of the root
`.env.example`.

```bash
# Backend
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../../.env.example .env  # then trim to what this service needs
uvicorn app.main:app --reload

# Scraper
cd apps/scraper
npm install
cp ../../.env.example .env
npm run dev        # runs the /run + /health server
npm run scrape      # runs one scrape pass directly, no server

# Frontend
cd apps/frontend
npm install
cp ../../.env.example .env
npm run dev
```

## Database

Schema lives as timestamped migrations in `supabase/migrations/`. Apply
them with the Supabase CLI or MCP `apply_migration` against a real project
— no project has been provisioned yet (see "Not done yet" below).

County scrapers are registered in `apps/scraper/src/counties/registry.js`.
`travisExample.js` is a template, not a live integration — it returns no
leads until a real per-county permit/bid-notice source is confirmed and
wired in. Counties without a registered scraper fall back to a stub that
returns zero leads rather than fabricating data.

## Lead capture wiring

`apps/scraper/src/lib/outreach.js` POSTs every captured lead to
`OUTREACH_ENGINE_URL`, source-tagged with `APP_NAME`, per the standard
stack's central outreach engine convention. It's a no-op if that env var
is unset, so the scraper runs standalone during development.

## Not done yet — needs your confirmation before touching anything live

This repo only contains code/config; no live infrastructure has been
provisioned:

- **Supabase project**: not created. Once created, apply the migrations,
  set `app.settings.scraper_url` / `app.settings.scraper_trigger_secret`
  (used by the `daily-county-scrape` cron job), and run the Supabase
  advisors check.
- **Railway services**: not connected. Three services (frontend, backend,
  scraper), each pointed at its `apps/<name>` subdirectory, env vars set
  from `.env.example`.
- **Domain / DNS**: not configured.
- **Outreach engine URL/key**: not set — confirm the real endpoint before
  wiring `OUTREACH_ENGINE_URL`.
- **County scrapers**: only a template exists. Each of the 254 counties
  needs its real permit/bid-notice source identified and implemented
  before it produces leads.
