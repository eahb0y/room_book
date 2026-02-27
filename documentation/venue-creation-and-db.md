# Создание заведения и DB-взаимодействие (текущая реализация)

Документ фиксирует, как сейчас работает создание заведения во frontend, какие параметры используются, какие запросы уходят в Supabase, и что нужно учесть при переносе логики на backend.

## 1. Точка входа и текущий flow

1. Роут [`/my-venue`] открыт в [App.tsx](../src/App.tsx:83) внутри `PrivateRoute`.
2. На странице [VenueManagement.tsx](../src/pages/admin/VenueManagement.tsx:14):
   - если пользователь не `admin`, происходит редирект на `/app`;
   - ищется `existingVenue` как первый venue, где `venue.adminId === user.id`.
3. До рендера формы в [Layout.tsx](../src/components/Layout.tsx:24) подгружается store:
   - для `admin`: `loadAdminData(user.id)`.
4. `loadAdminData` в [venueStore.ts](../src/store/venueStore.ts:56):
   - читает заведения админа,
   - читает комнаты этих заведений,
   - читает бронирования по каждому заведению.
5. При submit формы в [VenueManagement.tsx](../src/pages/admin/VenueManagement.tsx:50):
   - если `existingVenue` есть: `updateVenue(existingVenue.id, ...)`;
   - если нет: `createVenue(...)`.
6. Store обновляет локальный state через `mergeById`, UI показывает success/error.

## 2. Параметры создания заведения

### 2.1 Параметры формы (frontend)

- `name: string` - обязательно (проверка `trim()`).
- `address: string` - обязательно (проверка `trim()`).
- `description: string` - опционально (может быть пустой строкой).

Проверка на клиенте сейчас только базовая:
- при пустом `name` или `address` submit прерывается с ошибкой.

### 2.2 Параметры, передаваемые в store/api

Тип вызова в [venueStore.ts](../src/store/venueStore.ts:96):

```ts
createVenue({
  name: string,
  description: string,
  address: string,
  adminId: string, // user.id
})
```

Тип API в [venueApi.ts](../src/lib/venueApi.ts:52):

```ts
payload: {
  name: string;
  description: string;
  address: string;
  adminId: string;
}
```

### 2.3 Маппинг в БД (`public.venues`)

- `name` -> `name`
- `description` -> `description`
- `address` -> `address`
- `adminId` -> `admin_id`
- авто-поля БД: `id`, `created_at`, `app_env`

Схема таблицы: [supabase/schema.sql](../supabase/schema.sql:16)

## 3. Фактические DB-запросы по заведению

Все запросы выполняются из frontend через `supabaseDbRequest` ([supabaseHttp.ts](../src/lib/supabaseHttp.ts:95)).

### 3.1 Загрузка заведений админа (для формы/дашборда)

`GET /rest/v1/venues?select=*&admin_id=eq.{adminId}&order=created_at.desc`  
Источник: [venueApi.ts](../src/lib/venueApi.ts:22)

### 3.2 Создание заведения

`POST /rest/v1/venues` с `Prefer: return=representation`

```json
[
  {
    "name": "Коворкинг Центр",
    "description": "Описание",
    "address": "ул. Ленина, 1",
    "admin_id": "<uuid>"
  }
]
```

Источник: [venueApi.ts](../src/lib/venueApi.ts:52)

### 3.3 Обновление заведения

`PATCH /rest/v1/venues?id=eq.{venueId}` с `Prefer: return=representation`

Тело включает только переданные поля (`name`, `description`, `address`).

Источник: [venueApi.ts](../src/lib/venueApi.ts:82)

### 3.4 Смежные запросы, которые выполняются сразу после загрузки заведений админа

- Комнаты по venue_ids:  
  `GET /rest/v1/rooms?select=*&venue_id=in.({id1,id2,...})&order=created_at.desc`  
  Источник: [roomApi.ts](../src/lib/roomApi.ts:46)
- Бронирования по каждому venue:  
  `GET /rest/v1/bookings?select=...,rooms!inner(venue_id)&rooms.venue_id=eq.{venueId}&order=created_at.desc`  
  Источник: [bookingApi.ts](../src/lib/bookingApi.ts:88)

## 4. Ограничения и безопасность на уровне БД

### 4.1 RLS для `venues`

Файл: [supabase/schema.sql](../supabase/schema.sql:448)

- `SELECT`: разрешен владельцу (`admin_id = auth.uid()`) или участнику (`is_venue_member(id)`).
- `INSERT`: разрешен только если `admin_id = auth.uid()`.
- `UPDATE`: только владелец.
- `DELETE`: только владелец.

### 4.2 Важные ограничения схемы

- `admin_id` -> FK на `profiles(id)`.
- `description` not null, default `''`.
- `address` not null.
- `app_env` not null, check in (`dev`, `prod`).

### 4.3 Нюанс по `app_env`

`app_env` выставляется через `resolve_request_app_env()` и `current_setting('app.settings.app_env')`, а не из клиентского заголовка.  
См.: [supabase/schema.sql](../supabase/schema.sql:108), [20260216223000_harden_rls_and_invites.sql](../supabase/migrations/20260216223000_harden_rls_and_invites.sql:6)

## 5. Что важно учесть при переносе на backend

1. Убрать прямые DB-вызовы из frontend (`venueApi`, `roomApi`, `bookingApi`, `membershipApi`, `inviteApi`) и заменить на backend API.
2. На backend получать `adminId` из токена/сессии, а не доверять полю из тела запроса.
3. Повторить серверную валидацию:
   - `name` и `address` обязательны,
   - trimming строк,
   - ограничения длины (рекомендуется добавить, сейчас на клиенте не ограничено).
4. Оставить RLS в БД как второй контур защиты (defense in depth).
5. Желательно вернуть frontend один агрегированный endpoint для админа (venue + rooms + bookings), чтобы не делать fan-out запросов с клиента.

## 6. Рекомендуемый backend-контракт (минимум)

### 6.1 Создание заведения

`POST /api/venues`

Request:

```json
{
  "name": "Коворкинг Центр",
  "description": "Описание",
  "address": "ул. Ленина, 1"
}
```

Response:

```json
{
  "id": "uuid",
  "name": "Коворкинг Центр",
  "description": "Описание",
  "address": "ул. Ленина, 1",
  "adminId": "uuid",
  "createdAt": "2026-02-25T00:00:00.000Z"
}
```

### 6.2 Обновление заведения

`PATCH /api/venues/:id`

Request (partial):

```json
{
  "name": "Новое имя",
  "address": "Новый адрес"
}
```

### 6.3 Загрузка данных админа для экранов управления

`GET /api/admin/venue-context`  
Рекомендуемый ответ: `{ venues, rooms, bookings }` (или один `venue`, если бизнес-правило "1 админ = 1 заведение" будет закреплено на backend/в БД).

## 7. Технические риски текущей реализации

1. UI фактически ожидает одно заведение на админа (`find` по `adminId`), но в БД нет `UNIQUE(admin_id)`.
2. В текущем фронте часть проверок только клиентские (например, обязательность `name/address`), поэтому backend должен дублировать проверки.
3. Сейчас DB доступна напрямую из браузера; при переносе на backend нужно исключить этот путь и оставить только backend endpoints.
