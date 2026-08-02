# commercial-roofing-crm

Texas commercial roofing lead-gen platform. Part of Brandon's standard app
stack — see the `app-factory` skill for conventions shared across apps.

## Layout

- `apps/frontend` — Vite + React + TS + Tailwind, leads dashboard
- `apps/backend` — FastAPI, `/health` + `/leads` + `/counties`
- `apps/scraper` — Node/Express, `/health` + `/run` (daily cron target)
- `supabase/migrations` — schema + seed + `pg_cron` daily trigger

Three independent Railway services, one Supabase project, one repo.

## Conventions

- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `DATABASE_URL`, `APP_NAME`, `APP_URL`, `OUTREACH_ENGINE_URL`,
  `OUTREACH_ENGINE_API_KEY`. Don't invent new names for these concepts.
- RLS is on for every table in `supabase/migrations`. Backend and scraper
  write with the service-role key (bypasses RLS by design); the dashboard
  reads as an authenticated user.
- County scrapers live in `apps/scraper/src/counties/`, one file per
  county, registered in `registry.js`. A county with no registered scraper
  silently returns zero leads — it must never fabricate data.
- Leads are forwarded to the central outreach engine from
  `apps/scraper/src/lib/outreach.js`, source-tagged with `APP_NAME`.

## Before touching live systems

Confirm with Brandon before creating the Supabase project, connecting
Railway, or configuring DNS — nothing here has been provisioned yet.
