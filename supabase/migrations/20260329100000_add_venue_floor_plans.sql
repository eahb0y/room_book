create extension if not exists btree_gist;

create table if not exists public.venue_floor_plans (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  image_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env(),
  constraint venue_floor_plans_app_env_check check (app_env in ('dev', 'prod'))
);

alter table public.venue_floor_plans
  add column if not exists updated_at timestamptz not null default now();
alter table public.venue_floor_plans
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.venue_floor_plans
  alter column app_env set default public.resolve_request_app_env();
alter table public.venue_floor_plans
  drop constraint if exists venue_floor_plans_app_env_check;
alter table public.venue_floor_plans
  add constraint venue_floor_plans_app_env_check check (app_env in ('dev', 'prod'));

create table if not exists public.venue_tables (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.venue_floor_plans (id) on delete cascade,
  table_number text not null,
  capacity integer not null check (capacity > 0),
  x_position numeric(6, 3) not null,
  y_position numeric(6, 3) not null,
  width numeric(6, 3) not null,
  height numeric(6, 3) not null,
  shape text not null default 'rectangle' check (shape in ('rectangle', 'circle', 'square')),
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env(),
  constraint venue_tables_app_env_check check (app_env in ('dev', 'prod')),
  constraint venue_tables_position_range_check check (
    x_position >= 0
    and y_position >= 0
    and width > 0
    and height > 0
    and x_position <= 100
    and y_position <= 100
    and width <= 100
    and height <= 100
    and x_position + width <= 100
    and y_position + height <= 100
  )
);

alter table public.venue_tables
  add column if not exists notes text not null default '';
alter table public.venue_tables
  add column if not exists is_active boolean not null default true;
alter table public.venue_tables
  add column if not exists updated_at timestamptz not null default now();
alter table public.venue_tables
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.venue_tables
  alter column app_env set default public.resolve_request_app_env();
alter table public.venue_tables
  drop constraint if exists venue_tables_app_env_check;
alter table public.venue_tables
  add constraint venue_tables_app_env_check check (app_env in ('dev', 'prod'));
alter table public.venue_tables
  drop constraint if exists venue_tables_position_range_check;
alter table public.venue_tables
  add constraint venue_tables_position_range_check check (
    x_position >= 0
    and y_position >= 0
    and width > 0
    and height > 0
    and x_position <= 100
    and y_position <= 100
    and width <= 100
    and height <= 100
    and x_position + width <= 100
    and y_position + height <= 100
  );

create table if not exists public.venue_table_bookings (
  id uuid primary key default gen_random_uuid(),
  venue_table_id uuid not null references public.venue_tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guest_count integer not null check (guest_count > 0),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  start_at timestamp generated always as (booking_date::timestamp + start_time) stored,
  end_at timestamp generated always as (booking_date::timestamp + end_time) stored,
  app_env text not null default public.resolve_request_app_env(),
  constraint venue_table_bookings_app_env_check check (app_env in ('dev', 'prod')),
  constraint venue_table_bookings_valid_time_range check (start_time < end_time)
);

alter table public.venue_table_bookings
  add column if not exists notes text not null default '';
alter table public.venue_table_bookings
  add column if not exists updated_at timestamptz not null default now();
alter table public.venue_table_bookings
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.venue_table_bookings
  alter column app_env set default public.resolve_request_app_env();
alter table public.venue_table_bookings
  drop constraint if exists venue_table_bookings_app_env_check;
alter table public.venue_table_bookings
  add constraint venue_table_bookings_app_env_check check (app_env in ('dev', 'prod'));
alter table public.venue_table_bookings
  drop constraint if exists venue_table_bookings_valid_time_range;
alter table public.venue_table_bookings
  add constraint venue_table_bookings_valid_time_range check (start_time < end_time);
alter table public.venue_table_bookings
  drop constraint if exists venue_table_bookings_no_overlap;
alter table public.venue_table_bookings
  add constraint venue_table_bookings_no_overlap
  exclude using gist (
    venue_table_id with =,
    tsrange(start_at, end_at, '[)') with &&
  )
  where (status = 'active');

create unique index if not exists idx_venue_floor_plans_unique_name
on public.venue_floor_plans (venue_id, lower(name));

create index if not exists idx_venue_floor_plans_venue_id
on public.venue_floor_plans (venue_id);

create unique index if not exists idx_venue_tables_unique_number
on public.venue_tables (floor_plan_id, lower(table_number));

create index if not exists idx_venue_tables_floor_plan_id
on public.venue_tables (floor_plan_id);

create index if not exists idx_venue_table_bookings_table_id
on public.venue_table_bookings (venue_table_id);

create index if not exists idx_venue_table_bookings_user_id
on public.venue_table_bookings (user_id);

create index if not exists idx_venue_table_bookings_booking_date
on public.venue_table_bookings (booking_date);

create or replace function public.set_entity_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.ensure_venue_table_layout_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.x_position < 0
    or new.y_position < 0
    or new.width <= 0
    or new.height <= 0
    or new.x_position + new.width > 100
    or new.y_position + new.height > 100 then
    raise exception 'Стол должен находиться в границах плана';
  end if;

  if not new.is_active then
    return new;
  end if;

  if exists (
    select 1
    from public.venue_tables existing_table
    where existing_table.floor_plan_id = new.floor_plan_id
      and existing_table.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and existing_table.is_active = true
      and existing_table.x_position < new.x_position + new.width
      and existing_table.x_position + existing_table.width > new.x_position
      and existing_table.y_position < new.y_position + new.height
      and existing_table.y_position + existing_table.height > new.y_position
  ) then
    raise exception 'Стол пересекается с другим столом на плане';
  end if;

  return new;
end;
$$;

create or replace function public.touch_floor_plan_from_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_floor_plan_id uuid;
begin
  target_floor_plan_id := case
    when tg_op = 'DELETE' then old.floor_plan_id
    else new.floor_plan_id
  end;

  if target_floor_plan_id is not null then
    update public.venue_floor_plans
    set updated_at = now()
    where id = target_floor_plan_id;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_venue_table_mutable_fields_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.floor_plan_id is distinct from old.floor_plan_id
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Table identity is immutable';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_venue_table_booking_mutable_fields_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venue_id uuid;
begin
  if new.venue_table_id is distinct from old.venue_table_id
    or new.created_at is distinct from old.created_at
    or new.app_env is distinct from old.app_env then
    raise exception 'Table booking identity is immutable';
  end if;

  select fp.venue_id
  into target_venue_id
  from public.venue_tables vt
  join public.venue_floor_plans fp on fp.id = vt.floor_plan_id
  where vt.id = old.venue_table_id
  limit 1;

  if new.user_id is distinct from old.user_id then
    if target_venue_id is null or not public.has_business_manager_access(target_venue_id) then
      raise exception 'Booking user can be changed only by venue manager';
    end if;
  end if;

  if new.booking_date is null
    or new.start_time is null
    or new.end_time is null then
    raise exception 'Booking date and time are required';
  end if;

  if new.start_time >= new.end_time then
    raise exception 'Table booking end time must be later than start time';
  end if;

  if new.status not in ('active', 'cancelled') then
    raise exception 'Invalid table booking status';
  end if;

  return new;
end;
$$;

create or replace function public.list_available_venue_tables(
  p_venue_id uuid,
  p_booking_date date,
  p_start_time time,
  p_guests integer,
  p_duration_minutes integer default 120
)
returns table (
  floor_plan_id uuid,
  floor_plan_name text,
  floor_plan_image_path text,
  floor_plan_width integer,
  floor_plan_height integer,
  table_id uuid,
  table_number text,
  capacity integer,
  x_position numeric,
  y_position numeric,
  table_width numeric,
  table_height numeric,
  shape text,
  notes text,
  is_available boolean,
  is_capacity_match boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with requested_slot as (
    select
      p_booking_date::timestamp + p_start_time as start_at,
      p_booking_date::timestamp + p_start_time + make_interval(mins => greatest(15, least(coalesce(p_duration_minutes, 120), 720))) as end_at
  )
  select
    fp.id as floor_plan_id,
    fp.name as floor_plan_name,
    fp.image_path as floor_plan_image_path,
    fp.width as floor_plan_width,
    fp.height as floor_plan_height,
    vt.id as table_id,
    vt.table_number,
    vt.capacity,
    vt.x_position,
    vt.y_position,
    vt.width as table_width,
    vt.height as table_height,
    vt.shape,
    vt.notes,
    not exists (
      select 1
      from public.venue_table_bookings vtb
      cross join requested_slot rs
      where vtb.venue_table_id = vt.id
        and vtb.status = 'active'
        and vtb.app_env = public.resolve_request_app_env()
        and tsrange(vtb.start_at, vtb.end_at, '[)') && tsrange(rs.start_at, rs.end_at, '[)')
    ) as is_available,
    vt.capacity >= greatest(p_guests, 1) as is_capacity_match
  from public.venue_floor_plans fp
  join public.venue_tables vt on vt.floor_plan_id = fp.id
  where fp.venue_id = p_venue_id
    and fp.app_env = public.resolve_request_app_env()
    and vt.app_env = public.resolve_request_app_env()
    and vt.is_active = true
  order by fp.created_at asc, vt.table_number asc;
$$;

revoke all on function public.list_available_venue_tables(uuid, date, time, integer, integer) from public;
grant execute on function public.list_available_venue_tables(uuid, date, time, integer, integer) to anon;
grant execute on function public.list_available_venue_tables(uuid, date, time, integer, integer) to authenticated;

drop trigger if exists trg_set_venue_floor_plans_updated_at on public.venue_floor_plans;
create trigger trg_set_venue_floor_plans_updated_at
before update on public.venue_floor_plans
for each row
execute function public.set_entity_updated_at();

drop trigger if exists trg_set_venue_tables_updated_at on public.venue_tables;
create trigger trg_set_venue_tables_updated_at
before update on public.venue_tables
for each row
execute function public.set_entity_updated_at();

drop trigger if exists trg_set_venue_table_bookings_updated_at on public.venue_table_bookings;
create trigger trg_set_venue_table_bookings_updated_at
before update on public.venue_table_bookings
for each row
execute function public.set_entity_updated_at();

drop trigger if exists trg_ensure_venue_table_layout_integrity on public.venue_tables;
create trigger trg_ensure_venue_table_layout_integrity
before insert or update on public.venue_tables
for each row
execute function public.ensure_venue_table_layout_integrity();

drop trigger if exists trg_touch_floor_plan_from_table_insert on public.venue_tables;
create trigger trg_touch_floor_plan_from_table_insert
after insert or update or delete on public.venue_tables
for each row
execute function public.touch_floor_plan_from_table();

drop trigger if exists trg_enforce_venue_table_mutable_fields_update on public.venue_tables;
create trigger trg_enforce_venue_table_mutable_fields_update
before update on public.venue_tables
for each row
execute function public.enforce_venue_table_mutable_fields_update();

drop trigger if exists trg_enforce_venue_table_booking_mutable_fields_update on public.venue_table_bookings;
create trigger trg_enforce_venue_table_booking_mutable_fields_update
before update on public.venue_table_bookings
for each row
execute function public.enforce_venue_table_booking_mutable_fields_update();

alter table public.venue_floor_plans enable row level security;
alter table public.venue_tables enable row level security;
alter table public.venue_table_bookings enable row level security;

drop policy if exists venue_floor_plans_select_business on public.venue_floor_plans;
create policy venue_floor_plans_select_business
on public.venue_floor_plans
for select
using (
  venue_floor_plans.app_env = public.resolve_request_app_env()
  and public.has_business_portal_access(venue_floor_plans.venue_id)
);

drop policy if exists venue_floor_plans_select_public on public.venue_floor_plans;
create policy venue_floor_plans_select_public
on public.venue_floor_plans
for select
using (
  venue_floor_plans.app_env = public.resolve_request_app_env()
  and
  exists (
    select 1
    from public.venues v
    where v.id = venue_floor_plans.venue_id
  )
);

drop policy if exists venue_floor_plans_insert_manager on public.venue_floor_plans;
create policy venue_floor_plans_insert_manager
on public.venue_floor_plans
for insert
with check (public.has_business_manager_access(venue_floor_plans.venue_id));

drop policy if exists venue_floor_plans_update_manager on public.venue_floor_plans;
create policy venue_floor_plans_update_manager
on public.venue_floor_plans
for update
using (public.has_business_manager_access(venue_floor_plans.venue_id))
with check (public.has_business_manager_access(venue_floor_plans.venue_id));

drop policy if exists venue_floor_plans_delete_manager on public.venue_floor_plans;
create policy venue_floor_plans_delete_manager
on public.venue_floor_plans
for delete
using (public.has_business_manager_access(venue_floor_plans.venue_id));

drop policy if exists venue_tables_select_business on public.venue_tables;
create policy venue_tables_select_business
on public.venue_tables
for select
using (
  exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_portal_access(fp.venue_id)
  )
);

drop policy if exists venue_tables_select_public on public.venue_tables;
create policy venue_tables_select_public
on public.venue_tables
for select
using (
  is_active = true
  and exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
  )
);

drop policy if exists venue_tables_insert_manager on public.venue_tables;
create policy venue_tables_insert_manager
on public.venue_tables
for insert
with check (
  exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
);

drop policy if exists venue_tables_update_manager on public.venue_tables;
create policy venue_tables_update_manager
on public.venue_tables
for update
using (
  exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
)
with check (
  exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
);

drop policy if exists venue_tables_delete_manager on public.venue_tables;
create policy venue_tables_delete_manager
on public.venue_tables
for delete
using (
  exists (
    select 1
    from public.venue_floor_plans fp
    where fp.id = venue_tables.floor_plan_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
);

drop policy if exists venue_table_bookings_select_owner_or_manager on public.venue_table_bookings;
create policy venue_table_bookings_select_owner_or_manager
on public.venue_table_bookings
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.venue_tables vt
    join public.venue_floor_plans fp on fp.id = vt.floor_plan_id
    where vt.id = venue_table_bookings.venue_table_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_portal_access(fp.venue_id)
  )
);

drop policy if exists venue_table_bookings_insert_authenticated on public.venue_table_bookings;
create policy venue_table_bookings_insert_authenticated
on public.venue_table_bookings
for insert
with check (
  exists (
    select 1
    from public.venue_tables vt
    join public.venue_floor_plans fp on fp.id = vt.floor_plan_id
    where vt.id = venue_table_bookings.venue_table_id
      and vt.is_active = true
      and fp.app_env = public.resolve_request_app_env()
      and (
        venue_table_bookings.user_id = auth.uid()
        or public.has_business_manager_access(fp.venue_id)
      )
  )
);

drop policy if exists venue_table_bookings_update_owner_or_manager on public.venue_table_bookings;
create policy venue_table_bookings_update_owner_or_manager
on public.venue_table_bookings
for update
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.venue_tables vt
    join public.venue_floor_plans fp on fp.id = vt.floor_plan_id
    where vt.id = venue_table_bookings.venue_table_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.venue_tables vt
    join public.venue_floor_plans fp on fp.id = vt.floor_plan_id
    where vt.id = venue_table_bookings.venue_table_id
      and fp.app_env = public.resolve_request_app_env()
      and public.has_business_manager_access(fp.venue_id)
  )
);

grant select, insert, update, delete on public.venue_floor_plans to authenticated;
grant select, insert, update, delete on public.venue_tables to authenticated;
grant select, insert, update on public.venue_table_bookings to authenticated;

grant select on public.venue_floor_plans to anon;
grant select on public.venue_tables to anon;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'venue-floor-plans',
  'venue-floor-plans',
  true,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists venue_floor_plans_storage_public_read on storage.objects;
create policy venue_floor_plans_storage_public_read
on storage.objects
for select
using (bucket_id = 'venue-floor-plans');

drop policy if exists venue_floor_plans_storage_insert_manager on storage.objects;
create policy venue_floor_plans_storage_insert_manager
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venue-floor-plans'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.has_business_manager_access(((storage.foldername(name))[1])::uuid)
);

drop policy if exists venue_floor_plans_storage_update_manager on storage.objects;
create policy venue_floor_plans_storage_update_manager
on storage.objects
for update
to authenticated
using (
  bucket_id = 'venue-floor-plans'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.has_business_manager_access(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'venue-floor-plans'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.has_business_manager_access(((storage.foldername(name))[1])::uuid)
);

drop policy if exists venue_floor_plans_storage_delete_manager on storage.objects;
create policy venue_floor_plans_storage_delete_manager
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venue-floor-plans'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.has_business_manager_access(((storage.foldername(name))[1])::uuid)
);
