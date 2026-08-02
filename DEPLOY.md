# Deploy runbook

Everything below is a manual step in the Railway and Supabase dashboards —
neither has an API/MCP connection available from this session, so these
have to be done by hand. Copy-paste the env var tables directly; the
Supabase values are the real, live project's.

## 1. Create a dashboard login (do this first — it's 30 seconds)

Supabase dashboard → your project (`commercial-roofing-crm`,
`lspklioopbgwgmkxtycz`) → **Authentication → Users → Add user**. Give it
an email + password. That's the login the frontend's `Login.tsx` screen
expects — no account exists yet.

## 2. Connect Railway

Railway → New Project → **Deploy from GitHub repo** →
`ISNTX/commercial-roofing-crm`. Create **three services** from this one
repo, each with a different Root Directory:

| Service | Root Directory |
|---|---|
| frontend | `apps/frontend` |
| backend | `apps/backend` |
| scraper | `apps/scraper` |

Each already has a `railway.json` (build command, start command,
healthcheck path), so Railway should pick those up automatically once
Root Directory is set — no need to configure build/start commands by hand.

### Env vars — backend service

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://lspklioopbgwgmkxtycz.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_lD96k2bHpfrJglbMBn6MMA_1qKfQnbm` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(get from Supabase dashboard → Project Settings → API → service_role secret — not available to this session, never share this one outside Railway's env var UI)* |
| `CORS_ORIGINS` | the frontend's Railway URL, once known |
| `APP_NAME` | `commercial-roofing-crm` |

### Env vars — scraper service

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://lspklioopbgwgmkxtycz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | same service-role key as above |
| `SCRAPER_TRIGGER_SECRET` | any random string you generate — this gates the `/run` endpoint so only Supabase's cron job can trigger a scrape |
| `SCRAPE_CONCURRENCY` | `4` |
| `SCRAPE_DELAY_MS` | `5000` |
| `APP_NAME` | `commercial-roofing-crm` |
| `OUTREACH_ENGINE_URL` | leave unset until the real outreach engine endpoint is confirmed |
| `OUTREACH_ENGINE_API_KEY` | leave unset until confirmed |

### Env vars — frontend service

| Key | Value |
|---|---|
| `VITE_API_URL` | the backend's Railway URL, once known |
| `VITE_SUPABASE_URL` | `https://lspklioopbgwgmkxtycz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_lD96k2bHpfrJglbMBn6MMA_1qKfQnbm` |

Frontend and backend reference each other's URLs, so deploy backend
first, note its Railway URL, then set `VITE_API_URL` and `CORS_ORIGINS`
before deploying frontend.

## 3. Verify

Once deployed, each service should answer:

- `GET <backend-url>/health` → `{"status": "ok", ...}`
- `GET <scraper-url>/health` → `{"status": "ok", ...}`
- `<frontend-url>` → the login screen

Send me the backend and scraper URLs once they're live — I still need
the scraper's URL to apply the daily `pg_cron` trigger migration
(`supabase/migrations/20260802000200_daily_scrape_cron.sql`).

## 4. Apply the daily cron trigger (I do this once step 3 is confirmed)

Requires `app.settings.scraper_url` and `app.settings.scraper_trigger_secret`
set on the Supabase project (Database → Configuration → Custom Postgres
config), pointing at the scraper's live `/run` endpoint and the
`SCRAPER_TRIGGER_SECRET` from step 2.
