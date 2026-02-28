# Создание комнаты и работа с БД (текущая реализация)

Документ фиксирует, как сейчас работает создание комнаты во frontend, какие параметры используются, и какие запросы к БД выполняются. Цель: упростить перенос логики создания комнаты и DB-взаимодействия на backend.

## 1) Поток создания комнаты

1. Админ открывает форму на странице `src/pages/admin/RoomManagement.tsx`.
2. После submit вызывается `useVenueStore.createRoom(...)` из `src/store/venueStore.ts`.
3. Store вызывает `roomApi.createRoom(...)` из `src/lib/roomApi.ts`.
4. `roomApi` отправляет POST в Supabase REST (`/rest/v1/rooms`).
5. Ответ маппится в тип `Room` и кладется в Zustand store.

## 2) Параметры создания комнаты

### 2.1 Параметры из UI в store/api

`createRoom` получает:

- `venueId: string` — ID заведения (обязательно).
- `name: string` — название комнаты (обязательно, после `trim()`).
- `capacity: number` — вместимость (обязательно, целое число > 0).
- `photoUrls?: string[] | null` — список фото (опционально).
- `photoUrl?: string | null` — legacy поле, обычно первый элемент `photoUrls`.

### 2.2 Валидации и подготовка данных в UI

В `RoomManagement.tsx` перед вызовом `createRoom`:

- `name.trim()` не должен быть пустым.
- `capacity` парсится через `parseInt(..., 10)`, должно быть число `>= 1`.
- Для фото: максимум `8` изображений, MIME должен начинаться с `image/`, сжатие до JPEG (`quality = 0.82`), длинная сторона `<= 1400px`, размер каждого фото после сжатия `<= 1_500_000` байт.

### 2.3 Нормализация фото в API-слое

В `src/lib/roomApi.ts`:

- `normalizeRoomPhotoUrls(payload.photoUrls, payload.photoUrl)` нормализует список.
- `primaryPhotoUrl = photoUrls[0] ?? null`.
- В БД уходит: `photo_url = primaryPhotoUrl`, `photo_urls = весь массив` (если колонка поддерживается).

## 3) DB-запросы, связанные с комнатами

### 3.1 Создание комнаты (основной запрос)

Файл: `src/lib/roomApi.ts`, функция `createRoom`.

HTTP (Supabase REST):

- `POST /rest/v1/rooms`
- Header: `Prefer: return=representation`
- Body (массив из 1 объекта):

```json
[
  {
    "venue_id": "<venueId>",
    "name": "<name>",
    "capacity": 6,
    "photo_url": "<primaryPhotoOrNull>",
    "photo_urls": ["<photo1>", "<photo2>"]
  }
]
```

### 3.2 Fallback на legacy-схему

Если INSERT падает с ошибкой по `photo_urls` (например, `42703`, `pgrst204`, `schema cache`), выполняется повторный INSERT:

- `POST /rest/v1/rooms`
- Body без `photo_urls`, только `photo_url`.
- Если фото несколько, `photo_url` сериализуется строкой JSON через `serializeRoomPhotoUrlLegacy(...)`.

Это сделано для совместимости со старыми схемами БД.

### 3.3 Прочие запросы к таблице `rooms`

В том же `src/lib/roomApi.ts`:

- Список комнат:
  - `GET /rest/v1/rooms?select=*&venue_id=eq.<venueId>&order=created_at.desc`
  - `GET /rest/v1/rooms?select=*&venue_id=in.(<id1>,<id2>)&order=created_at.desc`
  - `GET /rest/v1/rooms?select=*&order=created_at.desc`
- Обновление комнаты: `PATCH /rest/v1/rooms?id=eq.<roomId>` (+ `Prefer: return=representation`).
- Удаление комнаты: `DELETE /rest/v1/rooms?id=eq.<roomId>` (+ `Prefer: return=minimal`).

### 3.4 Транспорт и auth для DB-запросов

Все запросы `roomApi` идут через `supabaseDbRequest` (`src/lib/supabaseHttp.ts`):

- Base URL: `<SUPABASE_URL>/rest/v1/...`
- Заголовок `apikey: <publishable_key>` обязателен.
- Заголовок `Authorization: Bearer <accessToken>` обязателен (иначе `Not authenticated`).
- `Content-Type: application/json` ставится автоматически, если есть body.
- Ошибки PostgREST пробрасываются как `Error(message/detail/hint/...)`.

## 4) SQL-контракт таблицы `public.rooms`

Источник: `supabase/schema.sql`.

Колонки/ограничения:

- `id uuid primary key default gen_random_uuid()`
- `venue_id uuid not null references public.venues(id) on delete cascade`
- `name text not null`
- `capacity integer not null check (capacity > 0)`
- `photo_url text`
- `photo_urls text[] not null default '{}'`
- `app_env text not null default public.resolve_request_app_env()`
- `created_at timestamptz not null default now()`

Индексы:

- `idx_rooms_venue_id` на `venue_id`

RLS policy для insert (`rooms_insert_admin`):

- вставка разрешена только если текущий `auth.uid()` является `admin_id` у `venues.id = rooms.venue_id`.

Следствие:

- создать комнату может только админ своего заведения;
- при удалении комнаты каскадно удаляются связанные бронирования (`bookings.room_id -> rooms.id on delete cascade`).

## 5) Что переносить на backend

Минимальный объем переноса:

1. Валидации `name/capacity/photo` из `RoomManagement.tsx`.
2. Нормализацию фото (`normalizeRoomPhotoUrls`) и вычисление cover (`photoUrls[0]`).
3. INSERT/PATCH/DELETE/SELECT для `rooms` из `roomApi.ts`.
4. Контроль прав уровня администратора заведения (аналог текущей RLS-логики).

Рекомендуемый backend-контракт для создания комнаты:

- Endpoint: `POST /api/rooms`
- Request body: `venueId: string`, `name: string`, `capacity: number`, `photoUrls?: string[]`.
- Response: `id, venueId, name, capacity, photoUrl, photoUrls, createdAt`.

## 6) Критичные моменты для миграции

- Сейчас frontend хранит фото как data URL и отправляет их напрямую в `rooms.photo_url/photo_urls`. Это быстро раздувает payload и БД.
- После переноса лучше хранить изображения в Storage, а в `rooms` сохранять только URL.
- Legacy fallback по `photo_urls` нужен только пока возможны старые схемы. Если backend работает с актуальной схемой, fallback можно убрать.
