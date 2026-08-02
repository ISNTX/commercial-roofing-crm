-- Initial schema: Texas commercial roofing lead-gen platform
-- Counties, contractors, leads, and scrape run tracking.

create extension if not exists "pgcrypto";

-- 254 Texas counties (seeded separately, see 20260802000100_seed_counties.sql)
create table if not exists counties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fips_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_number text,
  contractor_type text, -- e.g. 'commercial_roofing', 'general_contractor'
  phone text,
  email text,
  website text,
  county_id uuid references counties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contractors_county_id_idx on contractors(county_id);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  county_id uuid references counties(id) on delete set null,
  contractor_id uuid references contractors(id) on delete set null,
  source text not null, -- which scraper/source produced this lead
  project_type text, -- e.g. 'reroof', 'new_construction', 'repair'
  project_value_estimate numeric,
  address text,
  city text,
  state text not null default 'TX',
  zip text,
  contact_name text,
  contact_phone text,
  contact_email text,
  permit_url text,
  status text not null default 'new', -- new | contacted | qualified | disqualified
  raw_data jsonb not null default '{}'::jsonb,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_county_id_idx on leads(county_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_scraped_at_idx on leads(scraped_at desc);
create index if not exists leads_project_type_idx on leads(project_type);

-- One row per daily scrape run, per county, for observability.
create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  county_id uuid references counties(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running | success | failed
  leads_found integer not null default 0,
  error text
);

create index if not exists scrape_runs_county_id_idx on scrape_runs(county_id);

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists contractors_set_updated_at on contractors;
create trigger contractors_set_updated_at
  before update on contractors
  for each row execute function set_updated_at();

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- RLS: every user-data table locked down by default.
alter table counties enable row level security;
alter table contractors enable row level security;
alter table leads enable row level security;
alter table scrape_runs enable row level security;

-- Authenticated dashboard users can read everything (internal tool, no public data).
create policy "counties readable by authenticated" on counties
  for select to authenticated using (true);

create policy "contractors readable by authenticated" on contractors
  for select to authenticated using (true);

create policy "leads readable by authenticated" on leads
  for select to authenticated using (true);

create policy "leads updatable by authenticated" on leads
  for update to authenticated using (true) with check (true);

create policy "scrape_runs readable by authenticated" on scrape_runs
  for select to authenticated using (true);

-- Only the service role (backend/scraper) writes leads, contractors, and scrape_runs.
-- No insert/delete policies are granted to `authenticated` or `anon`; the
-- service role bypasses RLS entirely, which is how the FastAPI + scraper
-- services are expected to write data.
