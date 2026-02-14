-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'user')),
  first_name text,
  last_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  address text not null,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  photo_url text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists photo_url text;

alter table public.rooms
  add column if not exists photo_urls text[] not null default '{}';

update public.rooms
set photo_urls = array[photo_url]
where photo_url is not null
  and coalesce(cardinality(photo_urls), 0) = 0;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  venue_name text,
  token text not null unique,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  invitee_user_id uuid references public.profiles (id) on delete set null,
  invitee_first_name text,
  invitee_last_name text,
  invitee_email text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  revoked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'connected')),
  connected_at timestamptz,
  connected_user_id uuid references public.profiles (id) on delete set null,
  check (max_uses is null or max_uses > 0)
);

create table if not exists public.venue_memberships (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager')),
  joined_at timestamptz not null default now(),
  invitation_id uuid references public.invitations (id) on delete set null,
  unique (venue_id, user_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  start_at timestamp generated always as (booking_date::timestamp + start_time) stored,
  end_at timestamp generated always as (booking_date::timestamp + end_time) stored,
  check (start_time < end_time)
);

alter table public.bookings
  drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tsrange(start_at, end_at, '[)') with &&
  )
  where (status = 'active');

create index if not exists idx_venues_admin_id on public.venues (admin_id);
create index if not exists idx_rooms_venue_id on public.rooms (venue_id);
create index if not exists idx_memberships_user_id on public.venue_memberships (user_id);
create index if not exists idx_memberships_venue_id on public.venue_memberships (venue_id);
create index if not exists idx_bookings_room_id on public.bookings (room_id);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_invitations_venue_id on public.invitations (venue_id);
create index if not exists idx_invitations_token on public.invitations (token);
create index if not exists idx_invitations_email on public.invitations (invitee_email);

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.rooms enable row level security;
alter table public.venue_memberships enable row level security;
alter table public.bookings enable row level security;
alter table public.invitations enable row level security;

create or replace function public.is_venue_member(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_memberships vm
    where vm.venue_id = target_venue_id
      and vm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_venue_member(uuid) from public;
grant execute on function public.is_venue_member(uuid) to authenticated;

-- profiles

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- venues

drop policy if exists venues_select_admin_or_member on public.venues;
drop policy if exists venues_select_access on public.venues;
create policy venues_select_admin_or_member
on public.venues
for select
using (
  admin_id = auth.uid()
  or public.is_venue_member(id)
);

drop policy if exists venues_insert_admin on public.venues;
create policy venues_insert_admin
on public.venues
for insert
with check (admin_id = auth.uid());

drop policy if exists venues_update_admin on public.venues;
create policy venues_update_admin
on public.venues
for update
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists venues_delete_admin on public.venues;
create policy venues_delete_admin
on public.venues
for delete
using (admin_id = auth.uid());

-- rooms

drop policy if exists rooms_select_admin_or_member on public.rooms;
create policy rooms_select_admin_or_member
on public.rooms
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = rooms.venue_id
      and (
        v.admin_id = auth.uid()
        or exists (
          select 1
          from public.venue_memberships vm
          where vm.venue_id = v.id
            and vm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists rooms_insert_admin on public.rooms;
create policy rooms_insert_admin
on public.rooms
for insert
with check (
  exists (
    select 1
    from public.venues v
    where v.id = rooms.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists rooms_update_admin on public.rooms;
create policy rooms_update_admin
on public.rooms
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = rooms.venue_id
      and v.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = rooms.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists rooms_delete_admin on public.rooms;
create policy rooms_delete_admin
on public.rooms
for delete
using (
  exists (
    select 1
    from public.venues v
    where v.id = rooms.venue_id
      and v.admin_id = auth.uid()
  )
);

-- venue_memberships

drop policy if exists memberships_select_self_or_admin on public.venue_memberships;
drop policy if exists memberships_select_self on public.venue_memberships;
create policy memberships_select_self
on public.venue_memberships
for select
using (
  user_id = auth.uid()
);

drop policy if exists memberships_insert_self_or_admin on public.venue_memberships;
drop policy if exists memberships_insert_self on public.venue_memberships;
create policy memberships_insert_self
on public.venue_memberships
for insert
with check (
  user_id = auth.uid()
);

drop policy if exists memberships_update_self_or_admin on public.venue_memberships;
drop policy if exists memberships_update_self on public.venue_memberships;
create policy memberships_update_self
on public.venue_memberships
for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists memberships_delete_admin on public.venue_memberships;
drop policy if exists memberships_delete_self on public.venue_memberships;
create policy memberships_delete_self
on public.venue_memberships
for delete
using (
  user_id = auth.uid()
);

-- bookings

drop policy if exists bookings_select_owner_or_admin on public.bookings;
create policy bookings_select_owner_or_admin
on public.bookings
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    join public.venues v on v.id = r.venue_id
    where r.id = bookings.room_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists bookings_insert_member on public.bookings;
create policy bookings_insert_member
on public.bookings
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rooms r
    join public.venue_memberships vm on vm.venue_id = r.venue_id
    where r.id = bookings.room_id
      and vm.user_id = auth.uid()
  )
);

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

-- invitations

drop policy if exists invitations_select_admin_or_invitee on public.invitations;
create policy invitations_select_admin_or_invitee
on public.invitations
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
  or invitee_user_id = auth.uid()
  or lower(coalesce(invitee_email, '')) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''))
);

drop policy if exists invitations_insert_admin on public.invitations;
create policy invitations_insert_admin
on public.invitations
for insert
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists invitations_update_admin_or_invitee on public.invitations;
create policy invitations_update_admin_or_invitee
on public.invitations
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
  or invitee_user_id = auth.uid()
  or lower(coalesce(invitee_email, '')) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''))
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
  or invitee_user_id = auth.uid()
  or lower(coalesce(invitee_email, '')) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''))
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
