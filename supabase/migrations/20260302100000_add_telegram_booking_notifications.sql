create extension if not exists pgcrypto;

create table if not exists public.telegram_bot_connections (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  chat_id bigint not null,
  chat_type text not null default 'private' check (chat_type in ('private', 'group', 'supergroup', 'channel')),
  chat_title text,
  telegram_user_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  is_active boolean not null default true,
  last_notification_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env(),
  unique (venue_id)
);

alter table public.telegram_bot_connections
  add column if not exists chat_type text not null default 'private';
alter table public.telegram_bot_connections
  add column if not exists chat_title text;
alter table public.telegram_bot_connections
  add column if not exists telegram_user_id bigint;
alter table public.telegram_bot_connections
  add column if not exists telegram_username text;
alter table public.telegram_bot_connections
  add column if not exists telegram_first_name text;
alter table public.telegram_bot_connections
  add column if not exists telegram_last_name text;
alter table public.telegram_bot_connections
  add column if not exists is_active boolean not null default true;
alter table public.telegram_bot_connections
  add column if not exists last_notification_at timestamptz;
alter table public.telegram_bot_connections
  add column if not exists connected_at timestamptz not null default now();
alter table public.telegram_bot_connections
  add column if not exists updated_at timestamptz not null default now();
alter table public.telegram_bot_connections
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.telegram_bot_connections
  alter column app_env set default public.resolve_request_app_env();
alter table public.telegram_bot_connections
  alter column chat_type set default 'private';
alter table public.telegram_bot_connections
  drop constraint if exists telegram_bot_connections_chat_type_check;
alter table public.telegram_bot_connections
  add constraint telegram_bot_connections_chat_type_check check (chat_type in ('private', 'group', 'supergroup', 'channel'));
alter table public.telegram_bot_connections
  drop constraint if exists telegram_bot_connections_app_env_check;
alter table public.telegram_bot_connections
  add constraint telegram_bot_connections_app_env_check check (app_env in ('dev', 'prod'));

create table if not exists public.telegram_bot_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_chat_id bigint,
  used_connection_id uuid references public.telegram_bot_connections (id) on delete set null,
  created_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env()
);

alter table public.telegram_bot_activation_tokens
  add column if not exists used_at timestamptz;
alter table public.telegram_bot_activation_tokens
  add column if not exists used_chat_id bigint;
alter table public.telegram_bot_activation_tokens
  add column if not exists used_connection_id uuid references public.telegram_bot_connections (id) on delete set null;
alter table public.telegram_bot_activation_tokens
  add column if not exists created_at timestamptz not null default now();
alter table public.telegram_bot_activation_tokens
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.telegram_bot_activation_tokens
  alter column app_env set default public.resolve_request_app_env();
alter table public.telegram_bot_activation_tokens
  drop constraint if exists telegram_bot_activation_tokens_app_env_check;
alter table public.telegram_bot_activation_tokens
  add constraint telegram_bot_activation_tokens_app_env_check check (app_env in ('dev', 'prod'));

create table if not exists public.telegram_booking_notifications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'cancelled')),
  message_text text not null,
  delivery_state text not null default 'pending' check (delivery_state in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  app_env text not null default public.resolve_request_app_env()
);

alter table public.telegram_booking_notifications
  add column if not exists message_text text not null default '';
alter table public.telegram_booking_notifications
  add column if not exists delivery_state text not null default 'pending';
alter table public.telegram_booking_notifications
  add column if not exists attempts integer not null default 0;
alter table public.telegram_booking_notifications
  add column if not exists last_error text;
alter table public.telegram_booking_notifications
  add column if not exists claimed_at timestamptz;
alter table public.telegram_booking_notifications
  add column if not exists sent_at timestamptz;
alter table public.telegram_booking_notifications
  add column if not exists created_at timestamptz not null default now();
alter table public.telegram_booking_notifications
  add column if not exists app_env text not null default public.resolve_request_app_env();
alter table public.telegram_booking_notifications
  alter column app_env set default public.resolve_request_app_env();
alter table public.telegram_booking_notifications
  alter column delivery_state set default 'pending';
alter table public.telegram_booking_notifications
  drop constraint if exists telegram_booking_notifications_event_type_check;
alter table public.telegram_booking_notifications
  add constraint telegram_booking_notifications_event_type_check check (event_type in ('created', 'updated', 'cancelled'));
alter table public.telegram_booking_notifications
  drop constraint if exists telegram_booking_notifications_delivery_state_check;
alter table public.telegram_booking_notifications
  add constraint telegram_booking_notifications_delivery_state_check check (delivery_state in ('pending', 'processing', 'sent', 'failed', 'skipped'));
alter table public.telegram_booking_notifications
  drop constraint if exists telegram_booking_notifications_app_env_check;
alter table public.telegram_booking_notifications
  add constraint telegram_booking_notifications_app_env_check check (app_env in ('dev', 'prod'));

create index if not exists idx_telegram_bot_connections_venue_id on public.telegram_bot_connections (venue_id);
create index if not exists idx_telegram_bot_connections_chat_id on public.telegram_bot_connections (chat_id);
create unique index if not exists idx_telegram_bot_activation_tokens_token on public.telegram_bot_activation_tokens (token);
create index if not exists idx_telegram_bot_activation_tokens_venue_id on public.telegram_bot_activation_tokens (venue_id, created_at desc);
create index if not exists idx_telegram_booking_notifications_delivery_state on public.telegram_booking_notifications (delivery_state, created_at asc);
create index if not exists idx_telegram_booking_notifications_venue_id on public.telegram_booking_notifications (venue_id, created_at desc);

create or replace function public.telegram_chat_display_label(
  p_chat_title text,
  p_chat_type text,
  p_telegram_username text,
  p_telegram_first_name text,
  p_telegram_last_name text,
  p_chat_id bigint
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(coalesce(p_chat_title, '')), ''),
    case
      when nullif(trim(coalesce(p_telegram_username, '')), '') is not null
        then '@' || trim(p_telegram_username)
      else null
    end,
    nullif(trim(concat_ws(' ', p_telegram_first_name, p_telegram_last_name)), ''),
    case
      when p_chat_id is not null then 'chat ' || p_chat_id::text
      when nullif(trim(coalesce(p_chat_type, '')), '') is not null then trim(p_chat_type)
      else null
    end,
    'Telegram'
  );
$$;

create or replace function public.create_telegram_bot_activation(
  p_venue_id uuid
)
returns table (
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_venue public.venues%rowtype;
  next_token text := lower(
    substring(
      md5(random()::text || clock_timestamp()::text || coalesce(p_venue_id::text, ''))
      || md5(clock_timestamp()::text || random()::text || coalesce(auth.uid()::text, ''))
      from 1 for 48
    )
  );
  next_expires_at timestamptz := now() + interval '15 minutes';
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
    raise exception 'Только владелец бизнеса может подключить Telegram-бота';
  end if;

  delete from public.telegram_bot_activation_tokens
  where venue_id = p_venue_id
    and used_at is null;

  insert into public.telegram_bot_activation_tokens (
    venue_id,
    created_by_user_id,
    token,
    expires_at,
    app_env
  )
  values (
    p_venue_id,
    auth.uid(),
    next_token,
    next_expires_at,
    public.resolve_request_app_env()
  );

  return query
  select next_token, next_expires_at;
end;
$$;

revoke all on function public.create_telegram_bot_activation(uuid) from public;
grant execute on function public.create_telegram_bot_activation(uuid) to authenticated;

create or replace function public.get_telegram_bot_connection_status(
  p_venue_id uuid
)
returns table (
  venue_id uuid,
  is_connected boolean,
  chat_label text,
  connected_at timestamptz,
  last_notification_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_business_portal_access(p_venue_id) then
    raise exception 'Нет доступа к заведению';
  end if;

  return query
  select
    p_venue_id,
    connection_row.id is not null,
    case
      when connection_row.id is null then null
      else public.telegram_chat_display_label(
        connection_row.chat_title,
        connection_row.chat_type,
        connection_row.telegram_username,
        connection_row.telegram_first_name,
        connection_row.telegram_last_name,
        connection_row.chat_id
      )
    end,
    connection_row.connected_at,
    connection_row.last_notification_at
  from (
    select 1
  ) seed
  left join lateral (
    select *
    from public.telegram_bot_connections
    where public.telegram_bot_connections.venue_id = p_venue_id
      and is_active
    order by updated_at desc
    limit 1
  ) connection_row on true;
end;
$$;

revoke all on function public.get_telegram_bot_connection_status(uuid) from public;
grant execute on function public.get_telegram_bot_connection_status(uuid) to authenticated;

create or replace function public.activate_telegram_bot_link(
  p_token text,
  p_chat_id bigint,
  p_chat_type text default null,
  p_chat_title text default null,
  p_telegram_user_id bigint default null,
  p_telegram_username text default null,
  p_telegram_first_name text default null,
  p_telegram_last_name text default null
)
returns table (
  venue_id uuid,
  venue_name text,
  connected_at timestamptz,
  chat_label text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_token text := lower(trim(coalesce(p_token, '')));
  normalized_chat_type text := lower(trim(coalesce(p_chat_type, 'private')));
  target_token public.telegram_bot_activation_tokens%rowtype;
  target_venue public.venues%rowtype;
  target_connection public.telegram_bot_connections%rowtype;
begin
  if normalized_token = '' then
    raise exception 'Токен подключения не найден';
  end if;

  if normalized_chat_type not in ('private', 'group', 'supergroup', 'channel') then
    normalized_chat_type := 'private';
  end if;

  select *
  into target_token
  from public.telegram_bot_activation_tokens
  where token = normalized_token
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if target_token.id is null then
    raise exception 'Ссылка для подключения недействительна или устарела';
  end if;

  select *
  into target_venue
  from public.venues
  where id = target_token.venue_id
  limit 1;

  if target_venue.id is null then
    raise exception 'Заведение не найдено';
  end if;

  insert into public.telegram_bot_connections (
    venue_id,
    created_by_user_id,
    chat_id,
    chat_type,
    chat_title,
    telegram_user_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    is_active,
    connected_at,
    updated_at,
    app_env
  )
  values (
    target_token.venue_id,
    target_token.created_by_user_id,
    p_chat_id,
    normalized_chat_type,
    nullif(trim(coalesce(p_chat_title, '')), ''),
    p_telegram_user_id,
    nullif(trim(coalesce(p_telegram_username, '')), ''),
    nullif(trim(coalesce(p_telegram_first_name, '')), ''),
    nullif(trim(coalesce(p_telegram_last_name, '')), ''),
    true,
    now(),
    now(),
    target_token.app_env
  )
  on conflict on constraint telegram_bot_connections_venue_id_key do update
  set created_by_user_id = excluded.created_by_user_id,
      chat_id = excluded.chat_id,
      chat_type = excluded.chat_type,
      chat_title = excluded.chat_title,
      telegram_user_id = excluded.telegram_user_id,
      telegram_username = excluded.telegram_username,
      telegram_first_name = excluded.telegram_first_name,
      telegram_last_name = excluded.telegram_last_name,
      is_active = true,
      updated_at = now(),
      app_env = excluded.app_env
  returning *
  into target_connection;

  update public.telegram_bot_activation_tokens
  set used_at = now(),
      used_chat_id = p_chat_id,
      used_connection_id = target_connection.id
  where id = target_token.id;

  return query
  select
    target_connection.venue_id,
    target_venue.name,
    target_connection.connected_at,
    public.telegram_chat_display_label(
      target_connection.chat_title,
      target_connection.chat_type,
      target_connection.telegram_username,
      target_connection.telegram_first_name,
      target_connection.telegram_last_name,
      target_connection.chat_id
    );
end;
$$;

revoke all on function public.activate_telegram_bot_link(text, bigint, text, text, bigint, text, text, text) from public;
grant execute on function public.activate_telegram_bot_link(text, bigint, text, text, bigint, text, text, text) to service_role;

create or replace function public.enqueue_telegram_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms%rowtype;
  target_venue public.venues%rowtype;
  booker_label text;
  normalized_description text;
  event_type_value text;
  title_text text;
  message_text_value text;
begin
  select *
  into target_room
  from public.rooms
  where id = new.room_id
  limit 1;

  if target_room.id is null then
    return new;
  end if;

  select *
  into target_venue
  from public.venues
  where id = target_room.venue_id
  limit 1;

  if target_venue.id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.telegram_bot_connections c
    where c.venue_id = target_venue.id
      and c.is_active
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    event_type_value := 'created';
    title_text := 'Новая бронь';
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    event_type_value := 'cancelled';
    title_text := 'Бронь отменена';
  elsif new.user_id is distinct from old.user_id
    or new.booking_date is distinct from old.booking_date
    or new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.description is distinct from old.description
    or new.status is distinct from old.status then
    event_type_value := 'updated';
    title_text := 'Бронь обновлена';
  else
    return new;
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    nullif(trim(p.email), ''),
    'Клиент'
  )
  into booker_label
  from public.profiles p
  where p.id = new.user_id
  limit 1;

  normalized_description := nullif(trim(coalesce(new.description, '')), '');

  message_text_value := format(
    E'%s\n\nБизнес: %s\nКомната: %s\nКто забронировал: %s\nДата: %s\nВремя: %s - %s',
    title_text,
    target_venue.name,
    target_room.name,
    coalesce(booker_label, 'Клиент'),
    to_char(new.booking_date, 'DD.MM.YYYY'),
    to_char(new.start_time, 'HH24:MI'),
    to_char(new.end_time, 'HH24:MI')
  );

  if normalized_description is not null then
    message_text_value := message_text_value || E'\nКомментарий: ' || normalized_description;
  end if;

  insert into public.telegram_booking_notifications (
    venue_id,
    booking_id,
    event_type,
    message_text,
    app_env
  )
  values (
    target_venue.id,
    new.id,
    event_type_value,
    message_text_value,
    public.resolve_request_app_env()
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_telegram_booking_notification on public.bookings;
create trigger trg_enqueue_telegram_booking_notification
after insert or update on public.bookings
for each row
execute function public.enqueue_telegram_booking_notification();

create or replace function public.claim_telegram_booking_notifications(
  p_app_env text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  venue_id uuid,
  booking_id uuid,
  chat_id bigint,
  message_text text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  resolved_app_env text := case lower(trim(coalesce(p_app_env, '')))
    when 'dev' then 'dev'
    when 'prod' then 'prod'
    else public.resolve_request_app_env()
  end;
begin
  return query
  with picked as (
    select n.id, c.chat_id
    from public.telegram_booking_notifications n
    join public.telegram_bot_connections c
      on c.venue_id = n.venue_id
     and c.is_active
     and c.app_env = resolved_app_env
    where n.delivery_state = 'pending'
      and n.app_env = resolved_app_env
    order by n.created_at asc
    for update of n skip locked
    limit resolved_limit
  ),
  updated_rows as (
    update public.telegram_booking_notifications n
    set delivery_state = 'processing',
        claimed_at = now(),
        attempts = n.attempts + 1,
        last_error = null
    from picked
    where n.id = picked.id
    returning n.id, n.venue_id, n.booking_id, picked.chat_id, n.message_text, n.attempts
  )
  select *
  from updated_rows;
end;
$$;

revoke all on function public.claim_telegram_booking_notifications(text, integer) from public;
grant execute on function public.claim_telegram_booking_notifications(text, integer) to service_role;

create or replace function public.complete_telegram_booking_notification(
  p_notification_id uuid,
  p_delivery_state text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_state text := lower(trim(coalesce(p_delivery_state, '')));
  target_notification public.telegram_booking_notifications%rowtype;
begin
  if normalized_state not in ('sent', 'failed', 'skipped', 'pending') then
    raise exception 'Недопустимый статус уведомления';
  end if;

  update public.telegram_booking_notifications
  set delivery_state = normalized_state,
      sent_at = case when normalized_state = 'sent' then now() else sent_at end,
      last_error = nullif(trim(coalesce(p_error, '')), '')
  where id = p_notification_id
  returning *
  into target_notification;

  if target_notification.id is null then
    raise exception 'Уведомление не найдено';
  end if;

  if normalized_state = 'sent' then
    update public.telegram_bot_connections
    set last_notification_at = now(),
        updated_at = now()
    where venue_id = target_notification.venue_id
      and is_active;
  end if;
end;
$$;

revoke all on function public.complete_telegram_booking_notification(uuid, text, text) from public;
grant execute on function public.complete_telegram_booking_notification(uuid, text, text) to service_role;

alter table public.telegram_bot_connections enable row level security;
alter table public.telegram_bot_activation_tokens enable row level security;
alter table public.telegram_booking_notifications enable row level security;

drop policy if exists telegram_bot_connections_select_access on public.telegram_bot_connections;
create policy telegram_bot_connections_select_access
on public.telegram_bot_connections
for select
using (public.has_business_portal_access(venue_id));

grant usage on schema public to service_role;
grant select on public.telegram_bot_connections to authenticated;
grant select, insert, update, delete on public.telegram_bot_connections to service_role;
grant select, insert, update, delete on public.telegram_bot_activation_tokens to service_role;
grant select, insert, update, delete on public.telegram_booking_notifications to service_role;
