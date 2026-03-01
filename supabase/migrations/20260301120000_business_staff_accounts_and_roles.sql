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
