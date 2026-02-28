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

grant usage on schema public to anon;
grant select on public.business_service_categories to anon;
grant select on public.business_services to anon;

select pg_notify('pgrst', 'reload schema');
