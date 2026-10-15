-- Add Odessa (Ector County) and Midland (Midland County) to the cities table.
-- These are the first target markets for the commercial roofing CRM.
-- The odessaMidland.js scraper covers both cities.

insert into cities (name, county_id)
select city_name, c.id
from (values
  ('Odessa',  'Ector County'),
  ('Midland', 'Midland County')
) as seed(city_name, county_name)
join counties c on c.name = seed.county_name
on conflict (name) do nothing;
