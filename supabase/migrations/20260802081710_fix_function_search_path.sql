-- Advisor fix: pin search_path on the updated_at trigger function so it
-- can't be hijacked by a role-mutable search_path.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
