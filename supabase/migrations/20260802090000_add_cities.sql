-- Texas commercial building permits are issued by cities, not counties —
-- most of the 254 counties have no permitting authority at all outside
-- city limits. Add a city dimension so scrapers map onto how the data
-- actually exists, rolling up to county for reporting/filtering.

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  county_id uuid not null references counties(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists cities_county_id_idx on cities(county_id);

alter table leads add column if not exists city_id uuid references cities(id) on delete set null;
alter table contractors add column if not exists city_id uuid references cities(id) on delete set null;
alter table scrape_runs add column if not exists city_id uuid references cities(id) on delete set null;

create index if not exists leads_city_id_idx on leads(city_id);
create index if not exists scrape_runs_city_id_idx on scrape_runs(city_id);

-- scrape_runs was one-row-per-county-per-day; it's now one-row-per-city
-- (or per-county-source, for the handful of county-level permitting
-- authorities), so county_id alone is no longer required.
alter table scrape_runs alter column county_id drop not null;

alter table cities enable row level security;

create policy "cities readable by authenticated" on cities
  for select to authenticated using (true);

-- Seed the metro cities in scope for the first wave of scrapers (top TX
-- metro counties). Each city maps to the county its primary jurisdiction
-- falls in; several of these cities span more than one county in reality
-- (e.g. Frisco spans Collin/Denton) — this is the majority-share county,
-- good enough for reporting rollups, not a legal boundary.
insert into cities (name, county_id)
select city_name, c.id
from (values
  ('Houston', 'Harris County'),
  ('Pasadena', 'Harris County'),
  ('Baytown', 'Harris County'),
  ('Dallas', 'Dallas County'),
  ('Irving', 'Dallas County'),
  ('Garland', 'Dallas County'),
  ('Mesquite', 'Dallas County'),
  ('Grand Prairie', 'Dallas County'),
  ('Fort Worth', 'Tarrant County'),
  ('Arlington', 'Tarrant County'),
  ('North Richland Hills', 'Tarrant County'),
  ('San Antonio', 'Bexar County'),
  ('Austin', 'Travis County'),
  ('Pflugerville', 'Travis County'),
  ('Plano', 'Collin County'),
  ('McKinney', 'Collin County'),
  ('Frisco', 'Collin County'),
  ('Denton', 'Denton County'),
  ('Flower Mound', 'Denton County'),
  ('Sugar Land', 'Fort Bend County'),
  ('Missouri City', 'Fort Bend County'),
  ('Round Rock', 'Williamson County'),
  ('Georgetown', 'Williamson County'),
  ('Cedar Park', 'Williamson County'),
  ('El Paso', 'El Paso County')
) as seed(city_name, county_name)
join counties c on c.name = seed.county_name
on conflict (name) do nothing;
