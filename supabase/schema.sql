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
  activity_type text not null default '',
  admin_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.venues
  add column if not exists activity_type text not null default '';

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  description text not null default '',
  location text not null default '',
  access_type text not null default 'public' check (access_type in ('public', 'residents_only')),
  available_from time not null default '00:00',
  available_to time not null default '24:00',
  min_booking_minutes integer not null default 15 check (min_booking_minutes > 0 and min_booking_minutes <= 1440),
  max_booking_minutes integer not null default 240 check (
    max_booking_minutes > 0
    and max_booking_minutes <= 1440
    and max_booking_minutes >= min_booking_minutes
  ),
  capacity integer not null check (capacity > 0),
  services text[] not null default '{}',
  photo_url text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (available_from < available_to)
);

alter table public.rooms
  add column if not exists photo_url text;

alter table public.rooms
  add column if not exists photo_urls text[] not null default '{}';

alter table public.rooms
  add column if not exists description text not null default '';

alter table public.rooms
  add column if not exists location text not null default '';

alter table public.rooms
  add column if not exists services text[] not null default '{}';

alter table public.rooms
  add column if not exists access_type text not null default 'public';

alter table public.rooms
  add column if not exists available_from time not null default '00:00';

alter table public.rooms
  add column if not exists available_to time not null default '24:00';

alter table public.rooms
  add column if not exists min_booking_minutes integer not null default 15;

alter table public.rooms
  add column if not exists max_booking_minutes integer not null default 240;

alter table public.rooms
  drop constraint if exists rooms_access_type_check;
alter table public.rooms
  add constraint rooms_access_type_check check (access_type in ('public', 'residents_only'));

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

create table if not exists public.business_service_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  category_id uuid references public.business_service_categories (id) on delete set null,
  name text not null,
  providers jsonb not null default '[]'::jsonb,
  photo_url text,
  created_at timestamptz not null default now(),
  constraint business_services_providers_is_array check (jsonb_typeof(providers) = 'array')
);

alter table public.business_services
  add column if not exists category_id uuid references public.business_service_categories (id) on delete set null;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  description text not null default '',
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
  add column if not exists description text not null default '';

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
alter table public.business_service_categories
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.business_services
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
alter table public.business_service_categories
  alter column app_env set default public.resolve_request_app_env();
alter table public.business_services
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

alter table public.business_service_categories
  drop constraint if exists business_service_categories_app_env_check;
alter table public.business_service_categories
  add constraint business_service_categories_app_env_check check (app_env in ('dev', 'prod'));

alter table public.business_services
  drop constraint if exists business_services_app_env_check;
alter table public.business_services
  add constraint business_services_app_env_check check (app_env in ('dev', 'prod'));

alter table public.bookings
  drop constraint if exists bookings_app_env_check;
alter table public.bookings
  add constraint bookings_app_env_check check (app_env in ('dev', 'prod'));

create index if not exists idx_venues_admin_id on public.venues (admin_id);
create index if not exists idx_rooms_venue_id on public.rooms (venue_id);
create index if not exists idx_memberships_user_id on public.venue_memberships (user_id);
create index if not exists idx_memberships_venue_id on public.venue_memberships (venue_id);
create index if not exists idx_business_service_categories_venue_id on public.business_service_categories (venue_id);
create unique index if not exists idx_business_service_categories_unique_name on public.business_service_categories (venue_id, lower(name));
create index if not exists idx_business_services_venue_id on public.business_services (venue_id);
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

drop trigger if exists trg_enforce_booking_cancel_only_update on public.bookings;
drop trigger if exists trg_enforce_booking_mutable_fields_update on public.bookings;
create trigger trg_enforce_booking_mutable_fields_update
before update on public.bookings
for each row
execute function public.enforce_booking_mutable_fields_update();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.rooms enable row level security;
alter table public.venue_memberships enable row level security;
alter table public.bookings enable row level security;
alter table public.invitations enable row level security;
alter table public.business_service_categories enable row level security;
alter table public.business_services enable row level security;

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

create or replace function public.preview_invitation_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.invitations%rowtype;
  normalized_token text := lower(trim(coalesce(p_token, '')));
begin
  if normalized_token = '' then
    raise exception 'Приглашение не найдено';
  end if;

  select i.*
  into target_invitation
  from public.invitations i
  where i.token = normalized_token
  limit 1;

  if not found then
    raise exception 'Приглашение не найдено';
  end if;

  return jsonb_build_object(
    'id', target_invitation.id,
    'venueId', target_invitation.venue_id,
    'venueName', target_invitation.venue_name,
    'token', target_invitation.token,
    'createdAt', target_invitation.created_at,
    'expiresAt', target_invitation.expires_at,
    'maxUses', target_invitation.max_uses,
    'uses', target_invitation.uses,
    'revokedAt', target_invitation.revoked_at,
    'status', target_invitation.status,
    'connectedAt', target_invitation.connected_at,
    'connectedUserId', target_invitation.connected_user_id
  );
end;
$$;

revoke all on function public.preview_invitation_by_token(text) from public;
grant execute on function public.preview_invitation_by_token(text) to anon, authenticated;

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
drop policy if exists venues_select_public on public.venues;
create policy venues_select_public
on public.venues
for select
using (true);

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

-- business_service_categories

drop policy if exists business_service_categories_select_admin on public.business_service_categories;
create policy business_service_categories_select_admin
on public.business_service_categories
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_service_categories_select_public on public.business_service_categories;
create policy business_service_categories_select_public
on public.business_service_categories
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
  )
);

drop policy if exists business_service_categories_insert_admin on public.business_service_categories;
create policy business_service_categories_insert_admin
on public.business_service_categories
for insert
with check (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_service_categories_update_admin on public.business_service_categories;
create policy business_service_categories_update_admin
on public.business_service_categories
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
      and v.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_service_categories_delete_admin on public.business_service_categories;
create policy business_service_categories_delete_admin
on public.business_service_categories
for delete
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_service_categories.venue_id
      and v.admin_id = auth.uid()
  )
);

-- business_services

drop policy if exists business_services_select_admin on public.business_services;
create policy business_services_select_admin
on public.business_services
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_services_select_public on public.business_services;
create policy business_services_select_public
on public.business_services
for select
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
  )
);

drop policy if exists business_services_insert_admin on public.business_services;
create policy business_services_insert_admin
on public.business_services
for insert
with check (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_services_update_admin on public.business_services;
create policy business_services_update_admin
on public.business_services
for update
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
      and v.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists business_services_delete_admin on public.business_services;
create policy business_services_delete_admin
on public.business_services
for delete
using (
  exists (
    select 1
    from public.venues v
    where v.id = business_services.venue_id
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
grant select, insert, update, delete on public.business_service_categories to authenticated;
grant select, insert, update, delete on public.business_services to authenticated;
grant select, insert on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;
grant select, insert on public.invitations to authenticated;
grant update (expires_at, max_uses, revoked_at) on public.invitations to authenticated;

grant usage on schema public to anon;
revoke all on all tables in schema public from anon;
grant select on public.venues to anon;
grant select on public.rooms to anon;
grant select on public.business_service_categories to anon;
grant select on public.business_services to anon;

create table if not exists public.business_staff_accounts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'staff' check (role in ('manager', 'staff')),
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env()
);

alter table public.business_staff_accounts
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.business_staff_accounts
  alter column app_env set default public.resolve_request_app_env();
alter table public.business_staff_accounts
  drop constraint if exists business_staff_accounts_role_check;
alter table public.business_staff_accounts
  add constraint business_staff_accounts_role_check check (role in ('manager', 'staff'));
alter table public.business_staff_accounts
  drop constraint if exists business_staff_accounts_app_env_check;
alter table public.business_staff_accounts
  add constraint business_staff_accounts_app_env_check check (app_env in ('dev', 'prod'));

create unique index if not exists idx_business_staff_accounts_user_id on public.business_staff_accounts (user_id);
create unique index if not exists idx_business_staff_accounts_email on public.business_staff_accounts (lower(email));
create index if not exists idx_business_staff_accounts_venue_id on public.business_staff_accounts (venue_id);

create or replace function public.has_business_portal_access(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = target_venue_id
      and v.admin_id = auth.uid()
  ) or exists (
    select 1
    from public.business_staff_accounts bsa
    where bsa.venue_id = target_venue_id
      and bsa.user_id = auth.uid()
  );
$$;

revoke all on function public.has_business_portal_access(uuid) from public;
grant execute on function public.has_business_portal_access(uuid) to authenticated;

create or replace function public.has_business_manager_access(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = target_venue_id
      and v.admin_id = auth.uid()
  ) or exists (
    select 1
    from public.business_staff_accounts bsa
    where bsa.venue_id = target_venue_id
      and bsa.user_id = auth.uid()
      and bsa.role = 'manager'
  );
$$;

revoke all on function public.has_business_manager_access(uuid) from public;
grant execute on function public.has_business_manager_access(uuid) to authenticated;

create or replace function public.generate_business_staff_temporary_password()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  raw_password text;
begin
  raw_password := encode(gen_random_bytes(12), 'base64');
  raw_password := regexp_replace(raw_password, '[^A-Za-z0-9]', 'A', 'g');
  return 'Tmp' || substring(raw_password from 1 for 9) || '9!';
end;
$$;

create or replace function public.create_business_staff_account(
  p_venue_id uuid,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_email text
)
returns table (
  id uuid,
  venue_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  created_by_user_id uuid,
  created_at timestamptz,
  temporary_password text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_first_name text := trim(coalesce(p_first_name, ''));
  normalized_last_name text := trim(coalesce(p_last_name, ''));
  normalized_role text := lower(trim(coalesce(p_role, '')));
  normalized_email text := lower(trim(coalesce(p_email, '')));
  target_venue public.venues%rowtype;
  next_user_id uuid := gen_random_uuid();
  next_account public.business_staff_accounts%rowtype;
  next_password text := public.generate_business_staff_temporary_password();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_venue
  from public.venues
  where id = p_venue_id
  limit 1;

  if target_venue.id is null then
    raise exception 'Заведение не найдено';
  end if;

  if target_venue.admin_id <> auth.uid() then
    raise exception 'Только роль business может создавать сотрудников';
  end if;

  if normalized_first_name = '' or normalized_last_name = '' then
    raise exception 'Укажите имя и фамилию сотрудника';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'Недопустимая роль сотрудника';
  end if;

  if normalized_email = '' or normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Укажите корректный email для входа';
  end if;

  if (
    select count(*)
    from public.business_staff_accounts bsa
    where bsa.venue_id = p_venue_id
  ) >= 2 then
    raise exception 'Для одного бизнеса доступно максимум 3 входа в админку';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.email) = normalized_email
  ) or exists (
    select 1
    from auth.users u
    where lower(u.email) = normalized_email
      and u.deleted_at is null
  ) then
    raise exception 'Аккаунт с таким логином уже существует';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    next_user_id,
    'authenticated',
    'authenticated',
    normalized_email,
    crypt(next_password, gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', normalized_first_name,
      'last_name', normalized_last_name
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    next_user_id,
    next_user_id,
    jsonb_build_object(
      'sub', next_user_id::text,
      'email', normalized_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (
    id,
    email,
    role,
    first_name,
    last_name
  )
  values (
    next_user_id,
    normalized_email,
    'user',
    normalized_first_name,
    normalized_last_name
  );

  insert into public.business_staff_accounts (
    venue_id,
    user_id,
    email,
    first_name,
    last_name,
    role,
    created_by_user_id
  )
  values (
    p_venue_id,
    next_user_id,
    normalized_email,
    normalized_first_name,
    normalized_last_name,
    normalized_role,
    auth.uid()
  )
  returning *
  into next_account;

  return query
  select
    next_account.id,
    next_account.venue_id,
    next_account.user_id,
    next_account.email,
    next_account.first_name,
    next_account.last_name,
    next_account.role,
    next_account.created_by_user_id,
    next_account.created_at,
    next_password;
exception
  when unique_violation then
    raise exception 'Аккаунт с таким логином уже существует';
end;
$$;

revoke all on function public.create_business_staff_account(uuid, text, text, text, text) from public;
grant execute on function public.create_business_staff_account(uuid, text, text, text, text) to authenticated;

create or replace function public.update_business_staff_account_role(
  p_staff_account_id uuid,
  p_role text
)
returns setof public.business_staff_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text := lower(trim(coalesce(p_role, '')));
  target_account public.business_staff_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_role not in ('manager', 'staff') then
    raise exception 'Недопустимая роль сотрудника';
  end if;

  select *
  into target_account
  from public.business_staff_accounts
  where id = p_staff_account_id
  limit 1;

  if target_account.id is null then
    raise exception 'Сотрудник не найден';
  end if;

  if not exists (
    select 1
    from public.venues v
    where v.id = target_account.venue_id
      and v.admin_id = auth.uid()
  ) then
    raise exception 'Только роль business может менять роли сотрудников';
  end if;

  return query
  update public.business_staff_accounts
  set role = normalized_role
  where id = p_staff_account_id
  returning *;
end;
$$;

revoke all on function public.update_business_staff_account_role(uuid, text) from public;
grant execute on function public.update_business_staff_account_role(uuid, text) to authenticated;

create or replace function public.delete_business_staff_account(
  p_staff_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_account public.business_staff_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_account
  from public.business_staff_accounts
  where id = p_staff_account_id
  limit 1;

  if target_account.id is null then
    raise exception 'Сотрудник не найден';
  end if;

  if not exists (
    select 1
    from public.venues v
    where v.id = target_account.venue_id
      and v.admin_id = auth.uid()
  ) then
    raise exception 'Только роль business может удалять сотрудников';
  end if;

  delete from auth.users
  where id = target_account.user_id;
end;
$$;

revoke all on function public.delete_business_staff_account(uuid) from public;
grant execute on function public.delete_business_staff_account(uuid) to authenticated;

alter table public.business_staff_accounts enable row level security;

drop policy if exists business_staff_accounts_select_access on public.business_staff_accounts;
create policy business_staff_accounts_select_access
on public.business_staff_accounts
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.venues v
    where v.id = business_staff_accounts.venue_id
      and v.admin_id = auth.uid()
  )
);

drop policy if exists profiles_select_booking_admin on public.profiles;
create policy profiles_select_booking_admin
on public.profiles
for select
using (
  exists (
    select 1
    from public.bookings b
    join public.rooms r on r.id = b.room_id
    where b.user_id = profiles.id
      and public.has_business_manager_access(r.venue_id)
  )
);

drop policy if exists rooms_select_public on public.rooms;
create policy rooms_select_public
on public.rooms
for select
using (
  access_type = 'public'
  or (
    auth.uid() is not null
    and (
      public.has_business_portal_access(rooms.venue_id)
      or exists (
        select 1
        from public.venue_memberships vm
        where vm.venue_id = rooms.venue_id
          and vm.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists memberships_select_self_or_venue_admin on public.venue_memberships;
create policy memberships_select_self_or_venue_admin
on public.venue_memberships
for select
using (
  user_id = auth.uid()
  or public.has_business_portal_access(venue_memberships.venue_id)
);

drop policy if exists memberships_insert_admin_only on public.venue_memberships;
create policy memberships_insert_admin_only
on public.venue_memberships
for insert
with check (public.has_business_manager_access(venue_memberships.venue_id));

drop policy if exists memberships_update_admin_only on public.venue_memberships;
create policy memberships_update_admin_only
on public.venue_memberships
for update
using (public.has_business_manager_access(venue_memberships.venue_id))
with check (public.has_business_manager_access(venue_memberships.venue_id));

drop policy if exists memberships_delete_admin_only on public.venue_memberships;
create policy memberships_delete_admin_only
on public.venue_memberships
for delete
using (public.has_business_manager_access(venue_memberships.venue_id));

drop policy if exists bookings_select_owner_or_admin on public.bookings;
create policy bookings_select_owner_or_admin
on public.bookings
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    where r.id = bookings.room_id
      and public.has_business_portal_access(r.venue_id)
  )
);

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
            or public.has_business_portal_access(r.venue_id)
            or exists (
              select 1
              from public.venue_memberships vm
              where vm.venue_id = r.venue_id
                and vm.user_id = auth.uid()
            )
          )
        )
        or public.has_business_manager_access(r.venue_id)
      )
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
    where r.id = bookings.room_id
      and public.has_business_manager_access(r.venue_id)
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    where r.id = bookings.room_id
      and public.has_business_manager_access(r.venue_id)
  )
);

drop policy if exists invitations_select_admin_or_invitee on public.invitations;
create policy invitations_select_admin_or_invitee
on public.invitations
for select
using (
  public.has_business_portal_access(invitations.venue_id)
  or invitee_user_id = auth.uid()
  or lower(coalesce(invitee_email, '')) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''))
);

drop policy if exists invitations_insert_admin on public.invitations;
create policy invitations_insert_admin
on public.invitations
for insert
with check (
  created_by_user_id = auth.uid()
  and public.has_business_manager_access(invitations.venue_id)
);

drop policy if exists invitations_update_admin_only on public.invitations;
create policy invitations_update_admin_only
on public.invitations
for update
using (public.has_business_manager_access(invitations.venue_id))
with check (public.has_business_manager_access(invitations.venue_id));

grant select on public.business_staff_accounts to authenticated;
