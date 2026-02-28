-- Ensure profile avatar column exists for profile update API payloads.
-- Fixes errors like: Could not find the 'avatar_url' column of 'profiles' in the schema cache

alter table public.profiles
  add column if not exists avatar_url text;

grant update (first_name, last_name, avatar_url) on public.profiles to authenticated;

-- Ask PostgREST to refresh schema cache after DDL.
select pg_notify('pgrst', 'reload schema');
