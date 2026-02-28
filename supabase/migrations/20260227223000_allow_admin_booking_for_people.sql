create or replace function public.enforce_booking_mutable_fields_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is distinct from old.room_id
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Booking room is immutable';
  end if;

  if new.user_id is distinct from old.user_id then
    if not exists (
      select 1
      from public.rooms r
      join public.venues v on v.id = r.venue_id
      where r.id = old.room_id
        and v.admin_id = auth.uid()
    ) then
      raise exception 'Booking user can be changed only by venue admin';
    end if;
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

drop policy if exists bookings_insert_authenticated on public.bookings;
create policy bookings_insert_authenticated
on public.bookings
for insert
with check (
  exists (
    select 1
    from public.rooms r
    where r.id = bookings.room_id
      and (
        (
          user_id = auth.uid()
          and (
            r.access_type = 'public'
            or exists (
              select 1
              from public.venues v
              where v.id = r.venue_id
                and v.admin_id = auth.uid()
            )
            or exists (
              select 1
              from public.venue_memberships vm
              where vm.venue_id = r.venue_id
                and vm.user_id = auth.uid()
            )
          )
        )
        or exists (
          select 1
          from public.venues v
          where v.id = r.venue_id
            and v.admin_id = auth.uid()
        )
      )
  )
);
