-- Add room availability window and booking duration rules.

alter table public.rooms
  add column if not exists available_from time not null default '00:00';

alter table public.rooms
  add column if not exists available_to time not null default '24:00';

alter table public.rooms
  add column if not exists min_booking_minutes integer not null default 15;

alter table public.rooms
  add column if not exists max_booking_minutes integer not null default 240;

update public.rooms
set
  min_booking_minutes = 15,
  max_booking_minutes = greatest(coalesce(max_booking_minutes, 240), 15)
where min_booking_minutes is null or min_booking_minutes <= 0;

update public.rooms
set max_booking_minutes = greatest(min_booking_minutes, coalesce(max_booking_minutes, min_booking_minutes))
where max_booking_minutes is null or max_booking_minutes < min_booking_minutes;

update public.rooms
set
  available_from = '00:00',
  available_to = '24:00'
where available_from is null
  or available_to is null
  or available_from >= available_to;

alter table public.rooms
  drop constraint if exists rooms_available_range_check;
alter table public.rooms
  add constraint rooms_available_range_check check (available_from < available_to);

alter table public.rooms
  drop constraint if exists rooms_min_booking_minutes_check;
alter table public.rooms
  add constraint rooms_min_booking_minutes_check check (min_booking_minutes > 0 and min_booking_minutes <= 1440);

alter table public.rooms
  drop constraint if exists rooms_max_booking_minutes_check;
alter table public.rooms
  add constraint rooms_max_booking_minutes_check check (
    max_booking_minutes > 0
    and max_booking_minutes <= 1440
    and max_booking_minutes >= min_booking_minutes
  );
