create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.business_services (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_id text not null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  start_at timestamp generated always as (booking_date::timestamp + start_time) stored,
  end_at timestamp generated always as (booking_date::timestamp + end_time) stored,
  app_env text not null default public.resolve_request_app_env(),
  constraint service_bookings_valid_time_range check (start_time < end_time),
  constraint service_bookings_app_env_check check (app_env in ('dev', 'prod'))
);

alter table public.service_bookings
  add column if not exists app_env text not null default public.resolve_request_app_env();

alter table public.service_bookings
  alter column app_env set default public.resolve_request_app_env();

alter table public.service_bookings
  drop constraint if exists service_bookings_valid_time_range;
alter table public.service_bookings
  add constraint service_bookings_valid_time_range check (start_time < end_time);

alter table public.service_bookings
  drop constraint if exists service_bookings_app_env_check;
alter table public.service_bookings
  add constraint service_bookings_app_env_check check (app_env in ('dev', 'prod'));

alter table public.service_bookings
  drop constraint if exists service_bookings_no_overlap;
alter table public.service_bookings
  add constraint service_bookings_no_overlap
  exclude using gist (
    service_id with =,
    provider_id with =,
    tsrange(start_at, end_at, '[)') with &&
  )
  where (status = 'active');

create index if not exists idx_service_bookings_service_id on public.service_bookings (service_id);
create index if not exists idx_service_bookings_provider_id on public.service_bookings (provider_id);
create index if not exists idx_service_bookings_user_id on public.service_bookings (user_id);
create index if not exists idx_service_bookings_booking_date on public.service_bookings (booking_date);

create or replace function public.enforce_service_booking_mutable_fields_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.service_id is distinct from old.service_id
    or new.provider_id is distinct from old.provider_id
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Service booking identity is immutable';
  end if;

  if new.user_id is distinct from old.user_id then
    if not exists (
      select 1
      from public.business_services s
      where s.id = old.service_id
        and public.has_business_manager_access(s.venue_id)
    ) then
      raise exception 'Service booking user can be changed only by venue manager';
    end if;
  end if;

  if new.booking_date is null
    or new.start_time is null
    or new.end_time is null then
    raise exception 'Service booking date and time are required';
  end if;

  if new.start_time >= new.end_time then
    raise exception 'Service booking end time must be later than start time';
  end if;

  if new.status not in ('active', 'cancelled') then
    raise exception 'Invalid service booking status';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_service_booking_mutable_fields_update on public.service_bookings;
create trigger trg_enforce_service_booking_mutable_fields_update
before update on public.service_bookings
for each row
execute function public.enforce_service_booking_mutable_fields_update();

create or replace function public.list_service_booking_busy_slots(
  p_service_id uuid,
  p_provider_id text,
  p_booking_date date
)
returns table (
  start_time time,
  end_time time
)
language sql
stable
security definer
set search_path = public
as $$
  select sb.start_time, sb.end_time
  from public.service_bookings sb
  where sb.service_id = p_service_id
    and sb.provider_id = p_provider_id
    and sb.booking_date = p_booking_date
    and sb.status = 'active'
  order by sb.start_time asc;
$$;

revoke all on function public.list_service_booking_busy_slots(uuid, text, date) from public;
grant execute on function public.list_service_booking_busy_slots(uuid, text, date) to anon;
grant execute on function public.list_service_booking_busy_slots(uuid, text, date) to authenticated;

alter table public.service_bookings enable row level security;

drop policy if exists service_bookings_select_owner_or_admin on public.service_bookings;
create policy service_bookings_select_owner_or_admin
on public.service_bookings
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_services s
    where s.id = service_bookings.service_id
      and public.has_business_portal_access(s.venue_id)
  )
);

drop policy if exists service_bookings_insert_authenticated on public.service_bookings;
create policy service_bookings_insert_authenticated
on public.service_bookings
for insert
with check (
  exists (
    select 1
    from public.business_services s
    where s.id = service_bookings.service_id
      and exists (
        select 1
        from jsonb_array_elements(coalesce(s.providers, '[]'::jsonb)) provider
        where coalesce(
          provider ->> 'id',
          provider ->> 'staffId',
          provider ->> 'staff_id',
          provider ->> 'userId',
          provider ->> 'user_id'
        ) = service_bookings.provider_id
      )
      and (
        user_id = auth.uid()
        or public.has_business_manager_access(s.venue_id)
      )
  )
);

drop policy if exists service_bookings_update_owner_or_admin on public.service_bookings;
create policy service_bookings_update_owner_or_admin
on public.service_bookings
for update
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_services s
    where s.id = service_bookings.service_id
      and public.has_business_manager_access(s.venue_id)
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.business_services s
    where s.id = service_bookings.service_id
      and public.has_business_manager_access(s.venue_id)
  )
);

grant select, insert on public.service_bookings to authenticated;
grant update (status) on public.service_bookings to authenticated;
