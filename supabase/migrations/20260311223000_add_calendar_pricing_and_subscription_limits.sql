alter table public.business_staff_accounts
  add column if not exists is_active boolean not null default true;

create index if not exists idx_business_staff_accounts_venue_active
  on public.business_staff_accounts (venue_id, is_active);

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  family text not null check (family in ('free', 'plus', 'pro')),
  max_calendars integer,
  monthly_price integer not null default 0 check (monthly_price >= 0),
  annual_price integer not null default 0 check (annual_price >= 0),
  sort_order integer not null default 0,
  is_free boolean not null default false,
  features text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.venue_subscriptions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null unique references public.venues (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  plan_name text not null,
  plan_family text not null check (plan_family in ('free', 'plus', 'pro')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  max_calendars integer,
  price_monthly integer not null default 0 check (price_monthly >= 0),
  price_annually integer not null default 0 check (price_annually >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_limit_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  plan_id text references public.subscription_plans (id) on delete set null,
  event_type text not null check (event_type in ('calendar_limit_reached')),
  current_calendars_count integer not null check (current_calendars_count >= 0),
  max_calendars integer,
  created_by_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (
  id,
  name,
  family,
  max_calendars,
  monthly_price,
  annual_price,
  sort_order,
  is_free,
  features
)
values
  ('free_unlimited', 'Free', 'free', null, 0, 0, 10, true, array[
    'Unlimited calendars',
    'Online booking page',
    'No-login booking flow',
    'Booking history',
    'Basic onboarding'
  ]),
  ('plus_1cal', 'Месячный', 'plus', 1, 99000, 99000, 110, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_2cal', 'Месячный', 'plus', 2, 148000, 148000, 120, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_3cal', 'Месячный', 'plus', 3, 197000, 197000, 130, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_4cal', 'Месячный', 'plus', 4, 246000, 246000, 140, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_5cal', 'Месячный', 'plus', 5, 295000, 295000, 150, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_10cal', 'Месячный', 'plus', 10, 540000, 540000, 160, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_20cal', 'Месячный', 'plus', 20, 1030000, 1030000, 170, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('plus_unlimited', 'Месячный', 'plus', null, 1030000, 1030000, 180, false, array[
    'Client reminders',
    'Calendar sync',
    'Telegram notifications',
    'Team calendars'
  ]),
  ('pro_1cal', 'Годовой', 'pro', 1, 990000, 990000, 210, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_2cal', 'Годовой', 'pro', 2, 1480000, 1480000, 220, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_3cal', 'Годовой', 'pro', 3, 1970000, 1970000, 230, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_4cal', 'Годовой', 'pro', 4, 2460000, 2460000, 240, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_5cal', 'Годовой', 'pro', 5, 2950000, 2950000, 250, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_10cal', 'Годовой', 'pro', 10, 5400000, 5400000, 260, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_20cal', 'Годовой', 'pro', 20, 10300000, 10300000, 270, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ]),
  ('pro_unlimited', 'Годовой', 'pro', null, 10300000, 10300000, 280, false, array[
    'Advanced roles',
    'Multi-location controls',
    'Change history',
    'Dedicated launch'
  ])
on conflict (id) do update
set
  name = excluded.name,
  family = excluded.family,
  max_calendars = excluded.max_calendars,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  sort_order = excluded.sort_order,
  is_free = excluded.is_free,
  features = excluded.features;

create or replace function public.get_venue_calendar_usage(target_venue_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 1 + coalesce((
    select count(*)
    from public.business_staff_accounts bsa
    where bsa.venue_id = target_venue_id
      and bsa.is_active
  ), 0);
$$;

revoke all on function public.get_venue_calendar_usage(uuid) from public;

create or replace function public.log_calendar_limit_event(
  p_venue_id uuid,
  p_plan_id text,
  p_current_calendars_count integer,
  p_max_calendars integer,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_limit_events (
    venue_id,
    plan_id,
    event_type,
    current_calendars_count,
    max_calendars,
    created_by_user_id,
    metadata
  )
  values (
    p_venue_id,
    p_plan_id,
    'calendar_limit_reached',
    greatest(coalesce(p_current_calendars_count, 0), 0),
    p_max_calendars,
    auth.uid(),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_calendar_limit_event(uuid, text, integer, integer, jsonb) from public;

create or replace function public.apply_subscription_plan_to_venue(
  p_venue_id uuid,
  p_plan_id text,
  p_billing_cycle text default 'monthly'
)
returns public.venue_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan public.subscription_plans%rowtype;
  normalized_billing_cycle text := lower(trim(coalesce(p_billing_cycle, 'monthly')));
  next_subscription public.venue_subscriptions%rowtype;
begin
  if normalized_billing_cycle not in ('monthly', 'annual') then
    raise exception 'Недопустимый billing cycle';
  end if;

  select *
  into selected_plan
  from public.subscription_plans
  where id = p_plan_id
  limit 1;

  if selected_plan.id is null then
    raise exception 'Выбранный тариф не найден';
  end if;

  insert into public.venue_subscriptions (
    venue_id,
    plan_id,
    plan_name,
    plan_family,
    billing_cycle,
    max_calendars,
    price_monthly,
    price_annually,
    updated_at
  )
  values (
    p_venue_id,
    selected_plan.id,
    selected_plan.name,
    selected_plan.family,
    normalized_billing_cycle,
    selected_plan.max_calendars,
    selected_plan.monthly_price,
    selected_plan.annual_price,
    now()
  )
  on conflict (venue_id) do update
  set
    plan_id = excluded.plan_id,
    plan_name = excluded.plan_name,
    plan_family = excluded.plan_family,
    billing_cycle = excluded.billing_cycle,
    max_calendars = excluded.max_calendars,
    price_monthly = excluded.price_monthly,
    price_annually = excluded.price_annually,
    updated_at = now()
  returning *
  into next_subscription;

  return next_subscription;
end;
$$;

revoke all on function public.apply_subscription_plan_to_venue(uuid, text, text) from public;

create or replace function public.ensure_venue_subscription_exists(
  p_venue_id uuid
)
returns public.venue_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_subscription public.venue_subscriptions%rowtype;
begin
  select *
  into existing_subscription
  from public.venue_subscriptions
  where venue_id = p_venue_id
  limit 1;

  if existing_subscription.id is not null then
    return existing_subscription;
  end if;

  return public.apply_subscription_plan_to_venue(p_venue_id, 'free_unlimited', 'monthly');
end;
$$;

revoke all on function public.ensure_venue_subscription_exists(uuid) from public;

create or replace function public.initialize_venue_subscription_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_subscription_plan_to_venue(new.id, 'free_unlimited', 'monthly');
  return new;
end;
$$;

drop trigger if exists initialize_venue_subscription_on_insert on public.venues;
create trigger initialize_venue_subscription_on_insert
after insert on public.venues
for each row
execute function public.initialize_venue_subscription_trigger();

insert into public.venue_subscriptions (
  venue_id,
  plan_id,
  plan_name,
  plan_family,
  billing_cycle,
  max_calendars,
  price_monthly,
  price_annually
)
select
  v.id,
  p.id,
  p.name,
  p.family,
  'monthly',
  p.max_calendars,
  p.monthly_price,
  p.annual_price
from public.venues v
cross join public.subscription_plans p
left join public.venue_subscriptions vs on vs.venue_id = v.id
where p.id = 'free_unlimited'
  and vs.id is null;

create or replace function public.get_venue_subscription_snapshot(
  p_venue_id uuid
)
returns table (
  id uuid,
  venue_id uuid,
  plan_id text,
  plan_name text,
  plan_family text,
  billing_cycle text,
  max_calendars integer,
  price_monthly integer,
  price_annually integer,
  current_calendars_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription public.venue_subscriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_business_portal_access(p_venue_id) then
    raise exception 'Нет доступа к подписке бизнеса';
  end if;

  current_subscription := public.ensure_venue_subscription_exists(p_venue_id);

  return query
  select
    current_subscription.id,
    current_subscription.venue_id,
    current_subscription.plan_id,
    current_subscription.plan_name,
    current_subscription.plan_family,
    current_subscription.billing_cycle,
    current_subscription.max_calendars,
    current_subscription.price_monthly,
    current_subscription.price_annually,
    public.get_venue_calendar_usage(p_venue_id),
    current_subscription.created_at,
    current_subscription.updated_at;
end;
$$;

revoke all on function public.get_venue_subscription_snapshot(uuid) from public;
grant execute on function public.get_venue_subscription_snapshot(uuid) to authenticated;

create or replace function public.change_venue_subscription_plan(
  p_venue_id uuid,
  p_plan_id text,
  p_billing_cycle text default 'monthly'
)
returns table (
  id uuid,
  venue_id uuid,
  plan_id text,
  plan_name text,
  plan_family text,
  billing_cycle text,
  max_calendars integer,
  price_monthly integer,
  price_annually integer,
  current_calendars_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venue public.venues%rowtype;
  next_plan public.subscription_plans%rowtype;
  current_count integer;
  next_subscription public.venue_subscriptions%rowtype;
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
    raise exception 'Only business owners can change plans';
  end if;

  select *
  into next_plan
  from public.subscription_plans
  where id = p_plan_id
  limit 1;

  if next_plan.id is null then
    raise exception 'Выбранный тариф не найден';
  end if;

  current_count := public.get_venue_calendar_usage(p_venue_id);

  if next_plan.max_calendars is not null and current_count > next_plan.max_calendars then
    perform public.log_calendar_limit_event(
      p_venue_id,
      next_plan.id,
      current_count,
      next_plan.max_calendars,
      jsonb_build_object(
        'action', 'downgrade_blocked',
        'requested_plan_id', next_plan.id
      )
    );

    raise exception 'Your account currently has % calendars. Your new plan allows %. Please deactivate % calendar(s) before downgrading.',
      current_count,
      next_plan.max_calendars,
      current_count - next_plan.max_calendars;
  end if;

  next_subscription := public.apply_subscription_plan_to_venue(p_venue_id, next_plan.id, p_billing_cycle);

  return query
  select
    next_subscription.id,
    next_subscription.venue_id,
    next_subscription.plan_id,
    next_subscription.plan_name,
    next_subscription.plan_family,
    next_subscription.billing_cycle,
    next_subscription.max_calendars,
    next_subscription.price_monthly,
    next_subscription.price_annually,
    public.get_venue_calendar_usage(p_venue_id),
    next_subscription.created_at,
    next_subscription.updated_at;
end;
$$;

revoke all on function public.change_venue_subscription_plan(uuid, text, text) from public;
grant execute on function public.change_venue_subscription_plan(uuid, text, text) to authenticated;

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
  is_active boolean,
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
  current_subscription public.venue_subscriptions%rowtype;
  current_calendar_count integer;
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

  current_subscription := public.ensure_venue_subscription_exists(p_venue_id);
  current_calendar_count := public.get_venue_calendar_usage(p_venue_id);

  if current_subscription.max_calendars is not null and current_calendar_count >= current_subscription.max_calendars then
    perform public.log_calendar_limit_event(
      p_venue_id,
      current_subscription.plan_id,
      current_calendar_count,
      current_subscription.max_calendars,
      jsonb_build_object(
        'action', 'create_staff_blocked',
        'requested_email', normalized_email
      )
    );

    raise exception 'You''ve reached your calendar limit. Upgrade your plan to add more staff or resources.';
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
    is_active,
    created_by_user_id
  )
  values (
    p_venue_id,
    next_user_id,
    normalized_email,
    normalized_first_name,
    normalized_last_name,
    normalized_role,
    true,
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
    next_account.is_active,
    next_account.created_by_user_id,
    next_account.created_at,
    next_password;
end;
$$;

revoke all on function public.create_business_staff_account(uuid, text, text, text, text) from public;
grant execute on function public.create_business_staff_account(uuid, text, text, text, text) to authenticated;

create or replace function public.update_business_staff_account_active_state(
  p_staff_account_id uuid,
  p_is_active boolean
)
returns setof public.business_staff_accounts
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_account public.business_staff_accounts%rowtype;
  target_venue public.venues%rowtype;
  current_subscription public.venue_subscriptions%rowtype;
  current_calendar_count integer;
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

  select *
  into target_venue
  from public.venues
  where id = target_account.venue_id
  limit 1;

  if target_venue.id is null then
    raise exception 'Заведение не найдено';
  end if;

  if target_venue.admin_id <> auth.uid() then
    raise exception 'Только роль business может изменять статус сотрудника';
  end if;

  if target_account.is_active = p_is_active then
    return query
    select *
    from public.business_staff_accounts
    where id = p_staff_account_id;
    return;
  end if;

  if p_is_active then
    current_subscription := public.ensure_venue_subscription_exists(target_account.venue_id);
    current_calendar_count := public.get_venue_calendar_usage(target_account.venue_id);

    if current_subscription.max_calendars is not null and current_calendar_count >= current_subscription.max_calendars then
      perform public.log_calendar_limit_event(
        target_account.venue_id,
        current_subscription.plan_id,
        current_calendar_count,
        current_subscription.max_calendars,
        jsonb_build_object(
          'action', 'reactivate_staff_blocked',
          'staff_account_id', p_staff_account_id
        )
      );

      raise exception 'You''ve reached your calendar limit. Upgrade your plan to add more staff or resources.';
    end if;
  end if;

  update public.business_staff_accounts
  set is_active = p_is_active
  where id = p_staff_account_id;

  return query
  select *
  from public.business_staff_accounts
  where id = p_staff_account_id;
end;
$$;

revoke all on function public.update_business_staff_account_active_state(uuid, boolean) from public;
grant execute on function public.update_business_staff_account_active_state(uuid, boolean) to authenticated;

alter table public.venue_subscriptions enable row level security;

drop policy if exists venue_subscriptions_select_access on public.venue_subscriptions;
create policy venue_subscriptions_select_access
on public.venue_subscriptions
for select
using (public.has_business_portal_access(venue_id));

grant select on public.subscription_plans to authenticated;
grant select on public.subscription_plans to anon;
grant select on public.venue_subscriptions to authenticated;
