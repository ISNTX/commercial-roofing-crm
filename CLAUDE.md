# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Texas commercial roofing lead-gen platform: a daily scraper covers the
metro cities where commercial roofing volume concentrates, a FastAPI
service serves the leads over REST, and a Vite/React dashboard lets the
team browse and filter them. Part of Brandon's standard app stack — see
the `app-factory` skill for conventions shared across his other apps.

Live infra: one Supabase project (`commercial-roofing-crm`, ref
`lspklioopbgwgmkxtycz`) and three independent Railway services (one per
app below, deployed from this one repo/branch).

## Commands

There is no root-level build tool — each app under `apps/` is developed
and run independently from its own directory.

### Backend (`apps/backend`, FastAPI)

```bash
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # dev server, http://localhost:8000

ruff check .                       # lint (matches CI; B008 is intentionally ignored — see pyproject.toml)
python -c "import app.main"        # import smoke-check (matches CI)
```

No test suite exists yet.

### Scraper (`apps/scraper`, Node/Express)

```bash
cd apps/scraper
npm install
npm run dev        # /health + /run server, auto-restart on change
npm run scrape      # run one scrape pass directly (src/run.js), no server
node --check src/server.js   # syntax check (matches CI)
```

No test suite exists yet.

### Frontend (`apps/frontend`, Vite + React + TS)

```bash
cd apps/frontend
npm install
npm run dev         # http://localhost:5173
npm run build        # tsc -b && vite build — matches CI
npm run preview      # serve the production build locally
```

No test suite exists yet.

### Env vars

Each app reads its own `.env`; copy what it needs from the root
`.env.example`. Standard names only — don't invent new ones for these
concepts: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `APP_NAME`, `APP_URL`, `OUTREACH_ENGINE_URL`,
`OUTREACH_ENGINE_API_KEY`.

### Database migrations

Schema lives as timestamped SQL files in `supabase/migrations/`, applied
in order via the Supabase MCP `apply_migration` tool (not the CLI, not ad
hoc `execute_sql` — schema changes always go through a migration file
first, then get applied). The live project already has every migration
through `20260802090000_add_cities.sql` applied.

## Architecture

Three independently deployed services share one Postgres/Auth backend
(Supabase) and communicate only through it — the frontend and scraper
never call each other directly; the frontend proxies through the backend
API.

**Why cities, not just counties**: TX commercial building permits are
issued by *cities*, not counties — most of the state's 254 counties have
no permitting authority at all outside city limits. So the scraper and
lead data are keyed by city, and each city row carries its `county_id`
for rollup/reporting. See `supabase/migrations/20260802090000_add_cities.sql`
for the full rationale and the `cities` table shape.

**Auth model**: Supabase Auth (email/password) gates the dashboard.
`apps/frontend/src/lib/AuthProvider.tsx` holds the session; `api.ts`
attaches the session's access token as a Bearer header on every backend
call. The backend independently re-verifies that token against Supabase
Auth on every request (`apps/backend/app/core/auth.py::require_user`,
wired in as a router-level dependency) rather than trusting the frontend
— so the API can't be called without a valid session even if someone
finds the Railway URL directly.

**Write path bypasses RLS by design**: RLS is enabled on every table in
`supabase/migrations`, with `authenticated`-role read policies (and an
intentionally permissive `authenticated` update policy on `leads` — this
is a small internal-team tool, not multi-tenant). The backend and scraper
both connect with the Supabase **service-role** key
(`apps/backend/app/core/supabase.py`, `apps/scraper/src/lib/supabaseClient.js`),
which bypasses RLS entirely — that's the intended write path, not a gap.

**Scraper registration pattern**: city scrapers live one-file-per-city in
`apps/scraper/src/cities/`, registered by name in `registry.js`. A city
with no registered scraper falls back to a stub that returns zero leads —
it must never fabricate data. `austinExample.js` is a template showing
the expected lead-object shape, not a live integration. The daily run
(`apps/scraper/src/run.js`) reads the full city list live from the
`cities` table (not a hardcoded array) and fans out with bounded
concurrency (`SCRAPE_CONCURRENCY`, `SCRAPE_DELAY_MS`), recording one
`scrape_runs` row per city per run.

**Daily trigger**: Supabase `pg_cron` + `pg_net` (migration
`20260802000200_daily_scrape_cron.sql`) is meant to POST to the scraper's
`/run` endpoint once a day, authenticated via a shared `x-trigger-secret`
header (`SCRAPER_TRIGGER_SECRET` on the scraper service). That migration
depends on `app.settings.scraper_url` / `app.settings.scraper_trigger_secret`
being set on the Supabase project first, which needs the scraper's real
Railway URL.

**Lead capture wiring**: every lead the scraper inserts is also POSTed to
the central outreach engine (`apps/scraper/src/lib/outreach.js`),
source-tagged with `APP_NAME`. It's a no-op if `OUTREACH_ENGINE_URL` is
unset, so the scraper runs standalone during development.

**Deployment**: each app deploys as its own Railway service from this one
repo, distinguished only by Root Directory (`apps/frontend`,
`apps/backend`, `apps/scraper`) — see each app's `railway.json` for its
build/start/healthcheck config, and `DEPLOY.md` for the full manual setup
runbook (Railway isn't reachable via any API/MCP tool from a Claude Code
session, so connecting/configuring services is always a manual dashboard
step).

One non-obvious gotcha already hit in production: `vite preview` (used by
the frontend's `start` script) rejects requests whose `Host` header isn't
allow-listed, which silently 403s Railway's healthcheck against its
dynamic `*.up.railway.app` domain. Fixed via `preview.allowedHosts: true`
in `vite.config.ts` — don't remove it.

## Before touching live systems

Confirm with Brandon before configuring DNS. Supabase and Railway are
already provisioned — further Supabase schema changes still go through
`supabase/migrations/` + `apply_migration`, not ad hoc `execute_sql`.
