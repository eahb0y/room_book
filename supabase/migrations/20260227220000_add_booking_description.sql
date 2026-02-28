alter table public.bookings
  add column if not exists description text not null default '';
