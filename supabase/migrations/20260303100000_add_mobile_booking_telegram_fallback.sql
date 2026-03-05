do $$
begin
  if to_regclass('public.telegram_booking_notifications') is null
    or to_regclass('public.telegram_bot_connections') is null
    or to_regclass('public.bookings') is null then
    raise notice 'Telegram booking notification tables are missing. Apply base Telegram migrations first.';
    return;
  end if;
end;
$$;

create or replace function public.ensure_booking_created_telegram_notification(
  p_booking_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_booking public.bookings%rowtype;
  target_room public.rooms%rowtype;
  target_venue public.venues%rowtype;
  current_user_id uuid := auth.uid();
  booker_label text;
  normalized_description text;
  message_text_value text;
  resolved_app_env text := public.resolve_request_app_env();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = p_booking_id
  limit 1;

  if target_booking.id is null then
    raise exception 'Бронирование не найдено';
  end if;

  select *
  into target_room
  from public.rooms
  where id = target_booking.room_id
  limit 1;

  if target_room.id is null then
    return false;
  end if;

  select *
  into target_venue
  from public.venues
  where id = target_room.venue_id
  limit 1;

  if target_venue.id is null then
    return false;
  end if;

  if target_booking.user_id <> current_user_id
    and target_venue.admin_id <> current_user_id
    and not exists (
      select 1
      from public.venue_memberships vm
      where vm.venue_id = target_venue.id
        and vm.user_id = current_user_id
        and vm.role = 'manager'
    ) then
    raise exception 'Недостаточно прав для отправки уведомления по этой брони';
  end if;

  if not exists (
    select 1
    from public.telegram_bot_connections c
    where c.venue_id = target_venue.id
      and c.is_active
      and c.app_env = resolved_app_env
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.telegram_booking_notifications n
    where n.booking_id = target_booking.id
      and n.event_type = 'created'
      and n.app_env = resolved_app_env
  ) then
    return false;
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    nullif(trim(p.email), ''),
    'Клиент'
  )
  into booker_label
  from public.profiles p
  where p.id = target_booking.user_id
  limit 1;

  normalized_description := nullif(trim(coalesce(target_booking.description, '')), '');

  message_text_value := format(
    E'Новая бронь\n\nБизнес: %s\nКомната: %s\nКто забронировал: %s\nДата: %s\nВремя: %s - %s',
    target_venue.name,
    target_room.name,
    coalesce(booker_label, 'Клиент'),
    to_char(target_booking.booking_date, 'DD.MM.YYYY'),
    to_char(target_booking.start_time, 'HH24:MI'),
    to_char(target_booking.end_time, 'HH24:MI')
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
    target_booking.id,
    'created',
    message_text_value,
    resolved_app_env
  );

  return true;
end;
$$;

revoke all on function public.ensure_booking_created_telegram_notification(uuid) from public;
grant execute on function public.ensure_booking_created_telegram_notification(uuid) to authenticated;

notify pgrst, 'reload schema';
