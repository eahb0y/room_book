alter table public.venues
  add column if not exists activity_type text not null default '';
