# Профиль, комнаты и DB-взаимодействие (для переноса логики на backend)

Документ фиксирует текущую реализацию во frontend: какие параметры используются, какие DB-запросы выполняются, где есть `update/delete`, и какие ограничения наложены на уровне БД (RLS, trigger, grants).

Цель: перенести логику профиля и комнат на backend без потери текущего поведения.

## 1) Профиль (`profiles`)

### 1.1 Текущий flow

1. После `login` и `register` вызывается `ensureProfile`/`upsertProfile` в `src/lib/authApi.ts`.
2. Профиль редактируется на странице `src/pages/Profile.tsx`.
3. UI вызывает `useAuthStore.updateProfile(payload)` (`src/store/authStore.ts`).
4. Store вызывает `authApi.updateProfile(userId, payload)`.
5. `authApi` отправляет `PATCH` в `rest/v1/profiles`.

### 1.2 Параметры профиля

Тип обновления профиля (из `src/types/index.ts`):

- `firstName?: string`
- `lastName?: string`
- `avatarUrl?: string | null`

Подготовка на клиенте (`src/pages/Profile.tsx`):

- `firstName/lastName` сравниваются с текущими значениями после `trim()`.
- `avatarUrl` можно поставить в `null` (кнопка "Удалить фото").
- если изменений нет, `authApi.updateProfile` делает `GET profiles by id` и возвращает текущий профиль.

Валидации фото профиля (`src/pages/Profile.tsx`):

- только MIME `image/*`;
- сжатие до JPEG (`quality = 0.84`);
- ограничение длинной стороны: `900px`;
- размер после сжатия: до `900_000` байт.

### 1.3 Смена пароля (связано с профилем)

Тип (`src/types/index.ts`):

- `currentPassword: string`
- `newPassword: string`

Проверки в `authApi.changePassword`:

- оба поля обязательны;
- `newPassword.length >= 6`;
- новый пароль должен отличаться от текущего;
- текущий пароль проверяется через `POST /auth/v1/token?grant_type=password`;
- затем выполняется `PUT /auth/v1/user` с новым паролем.

### 1.4 DB-запросы по профилю

Источник: `src/lib/authApi.ts`.

1. Чтение профиля:
- `GET /rest/v1/profiles?select=*&id=eq.{userId}&limit=1`

2. Создание/обновление профиля при логине/регистрации:
- `POST /rest/v1/profiles?on_conflict=id`
- Header: `Prefer: resolution=merge-duplicates,return=representation`
- Body:

```json
[
  {
    "id": "<authUserId>",
    "email": "<normalizedEmail>",
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": "data:image/jpeg;base64,..."
  }
]
```

3. Обновление профиля:
- `PATCH /rest/v1/profiles?id=eq.{userId}`
- Header: `Prefer: return=representation`
- Body содержит только измененные поля (`first_name`, `last_name`, `avatar_url`).

### 1.5 Ограничения БД для профиля

Источник: `supabase/schema.sql`.

Таблица `public.profiles`:

- `id uuid primary key references auth.users(id) on delete cascade`
- `email text not null unique`
- `role text not null default 'user' check (role in ('admin', 'user'))`
- `first_name`, `last_name`, `avatar_url`
- `app_env` и `created_at`

Trigger `prevent_profile_email_update`:

- запрещает менять `email`;
- запрещает менять `role`, кроме сессии `service_role`.

RLS policies:

- `profiles_select_own`: читать свой профиль;
- `profiles_select_booking_admin`: админ может читать профиль пользователя, если у пользователя есть бронирование комнаты его заведения;
- `profiles_insert_own`: вставка только своей строки и только с `role = 'user'`;
- `profiles_update_own`: обновление только своей строки.

Grants:

- `grant select, insert on public.profiles to authenticated`
- `grant update (first_name, last_name, avatar_url) on public.profiles to authenticated`

Важно:

- прямого `DELETE` для `profiles` у `authenticated` нет;
- удаление профиля происходит каскадом от `auth.users` (`on delete cascade`).

## 2) Комнаты (`rooms`)

### 2.1 Текущий flow create/update/delete

1. Форма в `src/pages/admin/RoomManagement.tsx`.
2. UI вызывает `createRoom/updateRoom/deleteRoom` из `src/store/venueStore.ts`.
3. Store вызывает `src/lib/roomApi.ts`.
4. `roomApi` отправляет запросы в `rest/v1/rooms`.
5. Store обновляет локальный Zustand state.

### 2.2 Параметры комнаты

`createRoom`:

- `venueId: string` (обязательно)
- `name: string` (обязательно)
- `capacity: number` (обязательно, `> 0`)
- `photoUrls?: string[] | null`
- `photoUrl?: string | null` (legacy/cover)

`updateRoom`:

- `id: string`
- patch по полям: `name`, `capacity`, `photoUrls`, `photoUrl`

`deleteRoom`:

- `id: string`

Валидации в UI (`RoomManagement.tsx`):

- `name.trim()` обязателен;
- `capacity` парсится как `int`, должно быть `>= 1`;
- максимум `8` фото;
- MIME только `image/*`;
- сжатие JPEG (`quality = 0.82`, max side `1400px`);
- размер одного фото после сжатия до `1_500_000` байт.

### 2.3 DB-запросы по комнатам

Источник: `src/lib/roomApi.ts`.

Список:

- `GET /rest/v1/rooms?select=*&venue_id=eq.{venueId}&order=created_at.desc`
- `GET /rest/v1/rooms?select=*&venue_id=in.({id1,id2,...})&order=created_at.desc`
- `GET /rest/v1/rooms?select=*&order=created_at.desc`

Создание:

- `POST /rest/v1/rooms`
- Header: `Prefer: return=representation`
- Body:

```json
[
  {
    "venue_id": "<venueId>",
    "name": "Room A",
    "capacity": 6,
    "photo_url": "<coverOrNull>",
    "photo_urls": ["<photo1>", "<photo2>"]
  }
]
```

Fallback для legacy-схемы:

- если ошибка по колонке `photo_urls` (`42703`, `pgrst204`, `schema cache`), выполняется повторный `POST`/`PATCH` только с `photo_url`.

Обновление:

- `PATCH /rest/v1/rooms?id=eq.{roomId}`
- Header: `Prefer: return=representation`
- Body только по измененным полям.

Удаление:

- `DELETE /rest/v1/rooms?id=eq.{roomId}`
- Header: `Prefer: return=minimal`

### 2.4 Ограничения БД для комнат

Источник: `supabase/schema.sql`.

Таблица `public.rooms`:

- `venue_id` -> FK `public.venues(id) on delete cascade`
- `capacity integer not null check (capacity > 0)`
- `photo_url text`
- `photo_urls text[] not null default '{}'`
- `app_env`, `created_at`

RLS policies:

- `rooms_select_admin_or_member`: читать могут админ заведения или участник заведения;
- `rooms_insert_admin`: создавать может только админ заведения;
- `rooms_update_admin`: обновлять может только админ заведения;
- `rooms_delete_admin`: удалять может только админ заведения.

Grants:

- `grant select, insert, update, delete on public.rooms to authenticated`

Каскады:

- при удалении `rooms` удаляются связанные `bookings` (`bookings.room_id -> rooms.id on delete cascade`).

## 3) Связь профиля и комнат (важно для backend)

1. Policy `profiles_select_booking_admin` связывает `profiles <- bookings <- rooms <- venues`:
- админ получает доступ к профилю пользователя только если пользователь бронировал комнату его заведения.

2. В `bookingApi` используется join профиля бронирующего:
- `booker:profiles!bookings_user_id_fkey(email,first_name,last_name)`.

Это нужно учитывать, если backend будет агрегировать данные бронирований и пользователей.

## 4) Что переносить на backend в первую очередь

1. Профиль:
- `PATCH profile` (first/last/avatar),
- смена пароля,
- нормализация/валидация полей и фото.

2. Комнаты:
- `create/update/delete/list`,
- валидация `name/capacity/photo`,
- нормализация `photoUrls` и cover (`photoUrl = photoUrls[0]`).

3. Авторизация:
- `userId`/`role` извлекать из токена на backend, не доверять входному body.

4. Безопасность:
- оставить RLS в БД как второй контур,
- перенести бизнес-валидации в backend (defense in depth).

## 5) Рекомендуемый backend-контракт (минимум)

Профиль:

- `GET /api/profile/me`
- `PATCH /api/profile/me` -> `{ firstName?, lastName?, avatarUrl? }`
- `POST /api/profile/change-password` -> `{ currentPassword, newPassword }`

Комнаты:

- `GET /api/rooms?venueId=...`
- `POST /api/rooms`
- `PATCH /api/rooms/:id`
- `DELETE /api/rooms/:id`

## 6) Нюансы текущей реализации, которые стоит улучшить при миграции

1. Сейчас фото профиля и комнат хранятся как data URL прямо в БД.
2. Лучше вынести изображения в Storage и в таблицах хранить только URL.
3. После перехода на backend можно убрать fallback для legacy-колонки `photo_urls`, если схема везде актуальна.
