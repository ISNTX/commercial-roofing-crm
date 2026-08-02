# Commercial Roofing CRM

Texas commercial roofing lead-gen platform: a daily scraper covers the
metro cities where commercial roofing volume concentrates, a FastAPI
service serves the leads over REST, and a Vite/React dashboard lets the
team browse and filter them.

Permits are issued by **cities**, not counties — most of Texas's 254
counties have no permitting authority outside city limits. The schema
tracks both: a `cities` table (scraper target, joined to its county) rolls
up into `counties` (used for the top-level filter and reporting). See
`supabase/migrations/20260802090000_add_cities.sql`.

## Stack

- **Frontend** (`apps/frontend`): Vite + React + TypeScript + Tailwind, a
  TanStack Table leads dashboard with county/city/project-type/status
  filters. Gated behind Supabase email/password auth.
- **Backend** (`apps/backend`): FastAPI, reads/writes Supabase with the
  service-role key, exposes `/health`, `/leads`, `/counties`, `/cities`.
  Every route but `/health` requires a valid Supabase session token
  (verified against Supabase Auth on each request).
- **Scraper** (`apps/scraper`): Node/Express service. `/run` is triggered
  daily by Supabase `pg_cron` + `pg_net`; iterates every row in `cities`
  with bounded concurrency and forwards captured leads to the central
  outreach engine.
- **Database** (`supabase/migrations`): Postgres schema for counties,
  cities, contractors, leads, and scrape run history, with RLS enabled on
  every table (`authenticated` can read; only the service role writes).

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

Schema lives as timestamped migrations in `supabase/migrations/`, applied
in order via the Supabase MCP `apply_migration` (or the Supabase CLI). The
live project is `commercial-roofing-crm` (ref `lspklioopbgwgmkxtycz`); all
migrations through `20260802090000_add_cities.sql` are applied.

City scrapers are registered in `apps/scraper/src/cities/registry.js`.
`austinExample.js` is a template, not a live integration — it returns no
leads until a real permit/open-data source is confirmed and wired in.
Cities without a registered scraper fall back to a stub that returns zero
leads rather than fabricating data. 25 metro cities across the top 10 TX
counties are seeded (see the `cities` migration); more can be added the
same way once their source is confirmed.

## Lead capture wiring

`apps/scraper/src/lib/outreach.js` POSTs every captured lead to
`OUTREACH_ENGINE_URL`, source-tagged with `APP_NAME`, per the standard
stack's central outreach engine convention. It's a no-op if that env var
is unset, so the scraper runs standalone during development.

## Not done yet — needs your confirmation before touching anything live

- **Railway services**: not connected. Three services (frontend, backend,
  scraper), each pointed at its `apps/<name>` subdirectory, env vars set
  from `.env.example` (service-role key and JWT-related keys come from the
  Supabase dashboard, not this repo).
- **Domain / DNS**: not configured.
- **Outreach engine URL/key**: not set — confirm the real endpoint before
  wiring `OUTREACH_ENGINE_URL`.
- **Daily `pg_cron` trigger**: the migration
  (`20260802000200_daily_scrape_cron.sql`) hasn't been applied yet — it
  depends on `app.settings.scraper_url` / `app.settings.scraper_trigger_secret`,
  which need the scraper's real Railway URL first.
- **City scrapers**: only a template exists (`austinExample.js`). Each
  city needs its real permit/open-data source identified and verified
  before it produces real leads — this is blocked on confirming live
  endpoints (this dev sandbox has restricted network egress to third-party
  sites), not on code.
- **Dashboard users**: no accounts exist yet in Supabase Auth. Create one
  via the Supabase dashboard (Authentication → Users → Add user) to log in.
