drop trigger if exists trg_enforce_booking_cancel_only_update on public.bookings;
drop function if exists public.enforce_booking_cancel_only_update();

create or replace function public.enforce_booking_mutable_fields_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Booking room and owner are immutable';
  end if;

  if new.booking_date is null
    or new.start_time is null
    or new.end_time is null then
    raise exception 'Booking date and time are required';
  end if;

  if new.start_time >= new.end_time then
    raise exception 'Booking end time must be later than start time';
  end if;

  if new.status not in ('active', 'cancelled') then
    raise exception 'Invalid booking status';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_mutable_fields_update on public.bookings;
create trigger trg_enforce_booking_mutable_fields_update
before update on public.bookings
for each row
execute function public.enforce_booking_mutable_fields_update();

drop policy if exists bookings_update_owner_or_admin on public.bookings;
create policy bookings_update_owner_or_admin
on public.bookings
for update
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    join public.venues v on v.id = r.venue_id
    where r.id = bookings.room_id
      and v.admin_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    join public.venues v on v.id = r.venue_id
    where r.id = bookings.room_id
      and v.admin_id = auth.uid()
  )
);
