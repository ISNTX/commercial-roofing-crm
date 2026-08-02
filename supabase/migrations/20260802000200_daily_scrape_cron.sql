-- Daily trigger: pg_cron fires pg_net to POST to the scraper's /run
-- endpoint on Railway. Requires the `cron` and `net` extensions, which are
-- available on Supabase but must be enabled per-project (Database ->
-- Extensions, or via the dashboard SQL editor since they're restricted
-- extensions not always exposed to migrations).
--
-- app.settings.scraper_url and app.settings.scraper_trigger_secret must be
-- set on the project (Database -> Configuration -> Custom Postgres config,
-- or `alter database postgres set app.settings.scraper_url = '...'`) before
-- this job can run — they are intentionally not hardcoded here.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'daily-county-scrape',
    '0 11 * * *', -- 11:00 UTC = 5-6am Central, before business hours
    $$
    select net.http_post(
      url := current_setting('app.settings.scraper_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-trigger-secret', current_setting('app.settings.scraper_trigger_secret', true)
      ),
      body := '{}'::jsonb
    );
    $$
  )
where not exists (
  select 1 from cron.job where jobname = 'daily-county-scrape'
);
