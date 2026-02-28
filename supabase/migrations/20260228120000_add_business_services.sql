create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  providers jsonb not null default '[]'::jsonb,
  photo_url text,
  created_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env(),
  constraint business_services_providers_is_array check (jsonb_typeof(providers) = 'array'),
  constraint business_services_app_env_check check (app_env in ('dev', 'prod'))
);

alter table public.business_services
  add column if not exists photo_url text;

alter table public.business_services
  add column if not exists providers jsonb not null default '[]'::jsonb;

alter table public.business_services
  add column if not exists app_env text not null default public.resolve_request_app_env();

alter table public.business_services
  alter column app_env set default public.resolve_request_app_env();

alter table public.business_services
  drop constraint if exists business_services_providers_is_array;
alter table public.business_services
  add constraint business_services_providers_is_array check (jsonb_typeof(providers) = 'array');

alter table public.business_services
  drop constraint if exists business_services_app_env_check;
alter table public.business_services
  add constraint business_services_app_env_check check (app_env in ('dev', 'prod'));

create index if not exists idx_business_services_venue_id on public.business_services (venue_id);

alter table public.business_services enable row level security;

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

grant select, insert, update, delete on public.business_services to authenticated;

select pg_notify('pgrst', 'reload schema');
