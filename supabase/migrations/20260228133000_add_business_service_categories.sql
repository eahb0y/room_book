create table if not exists public.business_service_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env(),
  constraint business_service_categories_app_env_check check (app_env in ('dev', 'prod'))
);

alter table public.business_service_categories
  add column if not exists app_env text not null default public.resolve_request_app_env();

alter table public.business_service_categories
  alter column app_env set default public.resolve_request_app_env();

alter table public.business_service_categories
  drop constraint if exists business_service_categories_app_env_check;
alter table public.business_service_categories
  add constraint business_service_categories_app_env_check check (app_env in ('dev', 'prod'));

create index if not exists idx_business_service_categories_venue_id on public.business_service_categories (venue_id);
create unique index if not exists idx_business_service_categories_unique_name on public.business_service_categories (venue_id, lower(name));

alter table public.business_service_categories enable row level security;

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

alter table public.business_services
  add column if not exists category_id uuid references public.business_service_categories (id) on delete set null;

grant select, insert, update, delete on public.business_service_categories to authenticated;

select pg_notify('pgrst', 'reload schema');
