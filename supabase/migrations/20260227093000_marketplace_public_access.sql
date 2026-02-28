-- Marketplace access model:
-- 1) venues/rooms are publicly readable (catalog)
-- 2) any authenticated user can create booking for existing rooms
-- 3) invitations remain optional, not required for booking

drop policy if exists venues_select_admin_or_member on public.venues;
drop policy if exists venues_select_access on public.venues;
drop policy if exists venues_select_public on public.venues;
create policy venues_select_public
on public.venues
for select
using (true);

drop policy if exists rooms_select_admin_or_member on public.rooms;
drop policy if exists rooms_select_public on public.rooms;
create policy rooms_select_public
on public.rooms
for select
using (true);

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
  )
);

grant usage on schema public to anon;
revoke all on all tables in schema public from anon;
grant select on public.venues to anon;
grant select on public.rooms to anon;
