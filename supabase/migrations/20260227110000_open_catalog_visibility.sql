-- Ensure room/venue catalog is visible regardless of invitation membership state.
-- This migration is intentionally idempotent for projects with legacy policy names.

alter table public.venues enable row level security;
alter table public.rooms enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'venues'
      and upper(cmd) in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.venues', policy_row.policyname);
  end loop;

  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rooms'
      and upper(cmd) in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.rooms', policy_row.policyname);
  end loop;
end;
$$;

create policy venues_select_public
on public.venues
for select
using (true);

create policy rooms_select_public
on public.rooms
for select
using (true);

grant usage on schema public to authenticated;
grant select on public.venues to authenticated;
grant select on public.rooms to authenticated;

grant usage on schema public to anon;
grant select on public.venues to anon;
grant select on public.rooms to anon;
