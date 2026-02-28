alter table public.rooms
  add column if not exists description text not null default '';

alter table public.rooms
  add column if not exists location text not null default '';

alter table public.rooms
  add column if not exists services text[] not null default '{}';
