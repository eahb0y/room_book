alter table public.rooms
  add column if not exists access_type text not null default 'public';

alter table public.rooms
  drop constraint if exists rooms_access_type_check;
alter table public.rooms
  add constraint rooms_access_type_check check (access_type in ('public', 'residents_only'));

drop policy if exists rooms_select_admin_or_member on public.rooms;
drop policy if exists rooms_select_public on public.rooms;
create policy rooms_select_public
on public.rooms
for select
using (
  access_type = 'public'
  or (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.venues v
        where v.id = rooms.venue_id
          and v.admin_id = auth.uid()
      )
      or exists (
        select 1
        from public.venue_memberships vm
        where vm.venue_id = rooms.venue_id
          and vm.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists bookings_insert_member on public.bookings;
drop policy if exists bookings_insert_authenticated on public.bookings;
create policy bookings_insert_authenticated
on public.bookings
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rooms r
    where r.id = bookings.room_id
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
);
