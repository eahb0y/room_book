-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  first_name text,
  last_name text,
  avatar_url text,
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

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  alter column role set default 'user';

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

create or replace function public.resolve_request_app_env()
returns text
language sql
stable
as $$
  -- Metadata only: env is never derived from user-controlled request headers.
  select case lower(coalesce(nullif(current_setting('app.settings.app_env', true), ''), 'prod'))
    when 'dev' then 'dev'
    when 'prod' then 'prod'
    else 'prod'
  end;
$$;

alter table public.profiles
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.venues
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.rooms
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.invitations
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.venue_memberships
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.bookings
  add column if not exists app_env text not null default public.resolve_request_app_env();

alter table public.profiles
  alter column app_env set default public.resolve_request_app_env();
alter table public.venues
  alter column app_env set default public.resolve_request_app_env();
alter table public.rooms
  alter column app_env set default public.resolve_request_app_env();
alter table public.invitations
  alter column app_env set default public.resolve_request_app_env();
alter table public.venue_memberships
  alter column app_env set default public.resolve_request_app_env();
alter table public.bookings
  alter column app_env set default public.resolve_request_app_env();

alter table public.profiles
  drop constraint if exists profiles_app_env_check;
alter table public.profiles
  add constraint profiles_app_env_check check (app_env in ('dev', 'prod'));

alter table public.venues
  drop constraint if exists venues_app_env_check;
alter table public.venues
  add constraint venues_app_env_check check (app_env in ('dev', 'prod'));

alter table public.rooms
  drop constraint if exists rooms_app_env_check;
alter table public.rooms
  add constraint rooms_app_env_check check (app_env in ('dev', 'prod'));

alter table public.invitations
  drop constraint if exists invitations_app_env_check;
alter table public.invitations
  add constraint invitations_app_env_check check (app_env in ('dev', 'prod'));

alter table public.venue_memberships
  drop constraint if exists venue_memberships_app_env_check;
alter table public.venue_memberships
  add constraint venue_memberships_app_env_check check (app_env in ('dev', 'prod'));

alter table public.bookings
  drop constraint if exists bookings_app_env_check;
alter table public.bookings
  add constraint bookings_app_env_check check (app_env in ('dev', 'prod'));

create index if not exists idx_venues_admin_id on public.venues (admin_id);
create index if not exists idx_rooms_venue_id on public.rooms (venue_id);
create index if not exists idx_memberships_user_id on public.venue_memberships (user_id);
create index if not exists idx_memberships_venue_id on public.venue_memberships (venue_id);
create index if not exists idx_bookings_room_id on public.bookings (room_id);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_invitations_venue_id on public.invitations (venue_id);
create index if not exists idx_invitations_token on public.invitations (token);
create index if not exists idx_invitations_email on public.invitations (invitee_email);

create or replace function public.prevent_profile_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if new.email is distinct from old.email then
    raise exception 'Email cannot be changed in profile';
  end if;
  if new.role is distinct from old.role then
    if auth.uid() is not null and jwt_role <> 'service_role' then
      raise exception 'Role cannot be changed in profile';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_email_update on public.profiles;
create trigger trg_prevent_profile_email_update
before update on public.profiles
for each row
execute function public.prevent_profile_email_update();

create or replace function public.enforce_booking_cancel_only_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.booking_date is distinct from old.booking_date
    or new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Only booking cancellation is allowed';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'active' and new.status = 'cancelled' then
      return new;
    end if;
    raise exception 'Only booking cancellation is allowed';
  end if;

  if new.status <> 'cancelled' then
    raise exception 'Only booking cancellation is allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_cancel_only_update on public.bookings;
create trigger trg_enforce_booking_cancel_only_update
before update on public.bookings
for each row
execute function public.enforce_booking_cancel_only_update();

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

create or replace function public.redeem_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.invitations%rowtype;
  current_user_id uuid := auth.uid();
  current_user_email text := '';
  normalized_invitee_email text := '';
  inserted_membership_count integer := 0;
  existing_membership_invitation_id uuid := null;
  should_consume_use boolean := false;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_token), '') = '' then
    raise exception 'Приглашение не найдено или удалено';
  end if;

  select lower(coalesce(p.email, auth.jwt() ->> 'email', ''))
  into current_user_email
  from public.profiles p
  where p.id = current_user_id
  limit 1;

  if coalesce(current_user_email, '') = '' then
    current_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  end if;

  select i.*
  into target_invitation
  from public.invitations i
  where i.token = p_token
  for update;

  if not found then
    raise exception 'Приглашение не найдено или удалено';
  end if;

  if target_invitation.invitee_user_id is not null
    and target_invitation.invitee_user_id <> current_user_id then
    raise exception 'Приглашение предназначено для другого пользователя';
  end if;

  if target_invitation.revoked_at is not null
    or (target_invitation.expires_at is not null and target_invitation.expires_at <= now()) then
    raise exception 'Приглашение недействительно';
  end if;

  normalized_invitee_email := lower(coalesce(target_invitation.invitee_email, ''));
  if normalized_invitee_email <> '' then
    if coalesce(current_user_email, '') = '' then
      raise exception 'Не удалось определить email текущего пользователя';
    end if;
    if normalized_invitee_email <> current_user_email then
      raise exception 'Приглашение предназначено для другого email';
    end if;
  end if;

  insert into public.venue_memberships (venue_id, user_id, role, invitation_id, app_env)
  values (target_invitation.venue_id, current_user_id, 'member', target_invitation.id, target_invitation.app_env)
  on conflict (venue_id, user_id) do nothing;

  get diagnostics inserted_membership_count = row_count;
  should_consume_use := inserted_membership_count = 1;

  if not should_consume_use then
    select vm.invitation_id
    into existing_membership_invitation_id
    from public.venue_memberships vm
    where vm.venue_id = target_invitation.venue_id
      and vm.user_id = current_user_id
    for update;

    if not found then
      raise exception 'Не удалось применить приглашение';
    end if;

    if existing_membership_invitation_id is null then
      update public.venue_memberships vm
      set invitation_id = target_invitation.id,
          app_env = target_invitation.app_env
      where vm.venue_id = target_invitation.venue_id
        and vm.user_id = current_user_id
        and vm.invitation_id is null;

      get diagnostics inserted_membership_count = row_count;
      should_consume_use := inserted_membership_count = 1;
    elsif existing_membership_invitation_id = target_invitation.id then
      should_consume_use := false;
    else
      should_consume_use := false;
    end if;
  end if;

  if should_consume_use
    and target_invitation.max_uses is not null
    and target_invitation.uses >= target_invitation.max_uses then
    raise exception 'Приглашение недействительно';
  end if;

  update public.invitations
  set uses = case
        when should_consume_use then target_invitation.uses + 1
        else target_invitation.uses
      end,
      status = 'connected',
      connected_at = coalesce(target_invitation.connected_at, now()),
      connected_user_id = case
        when should_consume_use then current_user_id
        else coalesce(target_invitation.connected_user_id, current_user_id)
      end,
      invitee_user_id = coalesce(target_invitation.invitee_user_id, current_user_id)
  where id = target_invitation.id;

  return jsonb_build_object(
    'success', true,
    'venueId', target_invitation.venue_id,
    'invitationId', target_invitation.id
  );
end;
$$;

revoke all on function public.redeem_invitation(text) from public;
grant execute on function public.redeem_invitation(text) to authenticated;

-- profiles

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_select_booking_admin on public.profiles;
create policy profiles_select_booking_admin
on public.profiles
for select
using (
  exists (
    select 1
    from public.bookings b
    join public.rooms r on r.id = b.room_id
    join public.venues v on v.id = r.venue_id
    where b.user_id = profiles.id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (
  auth.uid() = id
  and role = 'user'
);

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
drop policy if exists memberships_select_self_or_venue_admin on public.venue_memberships;
create policy memberships_select_self_or_venue_admin
on public.venue_memberships
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.venues v
    where v.id = venue_memberships.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists memberships_insert_self_or_admin on public.venue_memberships;
drop policy if exists memberships_insert_self on public.venue_memberships;
drop policy if exists memberships_insert_admin_only on public.venue_memberships;
create policy memberships_insert_admin_only
on public.venue_memberships
for insert
with check (
  exists (
    select 1
    from public.venues v
    where v.id = venue_memberships.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists memberships_update_self_or_admin on public.venue_memberships;
drop policy if exists memberships_update_self on public.venue_memberships;
drop policy if exists memberships_update_admin_only on public.venue_memberships;
create policy memberships_update_admin_only
on public.venue_memberships
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = venue_memberships.venue_id
      and v.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = venue_memberships.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists memberships_delete_admin on public.venue_memberships;
drop policy if exists memberships_delete_self on public.venue_memberships;
drop policy if exists memberships_delete_admin_only on public.venue_memberships;
drop policy if exists memberships_delete_self_leave on public.venue_memberships;
create policy memberships_delete_admin_only
on public.venue_memberships
for delete
using (
  exists (
    select 1
    from public.venues v
    where v.id = venue_memberships.venue_id
      and v.admin_id = auth.uid()
  )
);
create policy memberships_delete_self_leave
on public.venue_memberships
for delete
using (user_id = auth.uid());

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
  bookings.status = 'cancelled'
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.rooms r
      join public.venues v on v.id = r.venue_id
      where r.id = bookings.room_id
        and v.admin_id = auth.uid()
    )
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
drop policy if exists invitations_update_invitee on public.invitations;
drop policy if exists invitations_update_invitee_redemption on public.invitations;
drop policy if exists invitations_update_admin_only on public.invitations;
create policy invitations_update_admin_only
on public.invitations
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = invitations.venue_id
      and v.admin_id = auth.uid()
  )
);

grant usage on schema public to authenticated;
revoke all on all tables in schema public from authenticated;
grant select, insert on public.profiles to authenticated;
grant update (first_name, last_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.venues to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.venue_memberships to authenticated;
grant select, insert on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;
grant select, insert on public.invitations to authenticated;
grant update (expires_at, max_uses, revoked_at) on public.invitations to authenticated;
