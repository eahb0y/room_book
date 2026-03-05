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

notify pgrst, 'reload schema';
