-- Security hardening for memberships/invitations/profile role/env boundaries.

alter table public.profiles
  alter column role set default 'user';

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

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (
  auth.uid() = id
  and role = 'user'
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
