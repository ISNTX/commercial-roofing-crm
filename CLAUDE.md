# commercial-roofing-crm

Texas commercial roofing lead-gen platform. Part of Brandon's standard app
stack — see the `app-factory` skill for conventions shared across apps.

## Layout

- `apps/frontend` — Vite + React + TS + Tailwind, leads dashboard (auth-gated)
- `apps/backend` — FastAPI, `/health` + `/leads` + `/counties` + `/cities`
- `apps/scraper` — Node/Express, `/health` + `/run` (daily cron target)
- `supabase/migrations` — schema + seed + `pg_cron` daily trigger

Three independent Railway services, one Supabase project
(`commercial-roofing-crm`, ref `lspklioopbgwgmkxtycz`, live), one repo.

## Conventions

- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `DATABASE_URL`, `APP_NAME`, `APP_URL`, `OUTREACH_ENGINE_URL`,
  `OUTREACH_ENGINE_API_KEY`. Don't invent new names for these concepts.
- RLS is on for every table in `supabase/migrations`. Backend and scraper
  write with the service-role key (bypasses RLS by design); the dashboard
  reads as an authenticated user (Supabase Auth email/password), and the
  backend independently verifies that session token on every request.
- TX commercial permits are issued by cities, not counties — scrapers are
  keyed by city (`apps/scraper/src/cities/`, one file per city, registered
  in `registry.js`), and each city row carries its county for rollups. A
  city with no registered scraper silently returns zero leads — it must
  never fabricate data.
- Leads are forwarded to the central outreach engine from
  `apps/scraper/src/lib/outreach.js`, source-tagged with `APP_NAME`.

## Before touching live systems

Confirm with Brandon before connecting Railway or configuring DNS.
Supabase is already provisioned and migrated — further schema changes
still go through `supabase/migrations/` + `apply_migration`, not ad hoc
`execute_sql`.
