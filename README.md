# Workspace Booking App (Supabase)

Frontend для бронирования комнат (React + TypeScript + Vite) с хранением данных в Supabase (Auth + Postgres + RLS).

Отдельный Laravel/Express backend для модуля планов не добавлялся: проект уже построен вокруг Supabase REST/RPC + Storage, поэтому новый функционал планов заведения реализован в том же стеке.

## Documentation

- Создание комнаты и DB-взаимодействие для миграции на backend: `documentation/room-creation-and-db.md`
- Создание заведения и DB-взаимодействие для миграции на backend: `documentation/venue-creation-and-db.md`
- Профиль + комнаты + DB-запросы (update/delete/права/RLS) для миграции на backend: `documentation/profile-room-db-backend-migration.md`

## Setup

### 1) Требования

- Node.js 20+
- npm 10+
- Supabase project (dev/prod или один общий)

### 2) Инициализация БД

1. Откройте SQL Editor в Supabase.
2. Выполните скрипт `supabase/schema.sql`.
3. Затем выполните миграцию `supabase/migrations/20260329100000_add_venue_floor_plans.sql` для планов заведений, столов, table bookings и storage bucket.
4. В Supabase проверьте Auth -> Providers -> Email:
   - отключите подтверждение email (Confirm email), если хотите получать сессию сразу после регистрации.

### 3) Переменные окружения

1. Создайте `.env` на основе `.env.example`.
2. Заполните значения:

```bash
# Dev Supabase
VITE_SUPABASE_DEV_URL=https://your-dev-project-ref.supabase.co
VITE_SUPABASE_DEV_PUBLISHABLE_KEY=sb_publishable_dev_xxx

# Prod Supabase
VITE_SUPABASE_PROD_URL=https://your-prod-project-ref.supabase.co
VITE_SUPABASE_PROD_PUBLISHABLE_KEY=sb_publishable_prod_xxx

# Public URL of deployed app (for SEO canonical/OG + sitemap/robots generation)
# VITE_SITE_URL=https://app.example.com

# Optional override: dev | prod
# VITE_APP_ENV=dev
```

Как выбирается окружение:
- на `localhost` по умолчанию используется `dev`;
- в production-сборке по умолчанию `prod`;
- можно принудительно переопределить через `VITE_APP_ENV`.

### 4) Локальный запуск

```bash
npm install
npm run dev
```

Полезные команды:

```bash
npm run lint
npm run build
npm run preview
```

### Telegram notifications worker

Уведомления в Telegram отправляет отдельный worker-процесс. SQL-триггер в Supabase только складывает события в очередь `telegram_booking_notifications`.

Переменные окружения для worker:

```bash
APP_ENV=dev
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_xxx
TELEGRAM_BOT_TOKEN=123456:ABCDEF
```

Запуск:

```bash
npm run telegram:worker
```

Разовый прогон:

```bash
npm run telegram:worker:once
```

## Бизнес-правила

## Floor Plans Module

### Что добавлено

- Админский раздел `/floor-plans` в бизнес-кабинете.
- Пользовательская страница выбора столов `/venue/:venueId/tables`.
- SQL-миграция:
  - `venue_floor_plans`
  - `venue_tables`
  - `venue_table_bookings`
  - storage bucket `venue-floor-plans`
  - RLS/policies и RPC `list_available_venue_tables`
- Клиентский API:
  - [`src/lib/floorPlanApi.ts`](src/lib/floorPlanApi.ts)
- UI-компоненты:
  - [`src/components/floor-plans/FloorPlanList.tsx`](src/components/floor-plans/FloorPlanList.tsx)
  - [`src/components/floor-plans/FloorPlanEditor.tsx`](src/components/floor-plans/FloorPlanEditor.tsx)
  - [`src/components/floor-plans/TableSelection.tsx`](src/components/floor-plans/TableSelection.tsx)
  - [`src/components/floor-plans/floor-plan.css`](src/components/floor-plans/floor-plan.css)

### Что уже покрыто

- Загрузка JPG/PNG плана до 5 MB.
- Автоматическое определение размеров изображения.
- Несколько планов на одно заведение.
- Добавление, редактирование, удаление и drag-and-drop столов.
- Клиентский выбор стола с цветовой индикацией и бронированием на 2-часовой слот.
- Валидация границ, уникальности номера стола внутри плана и пересечений столов.
- Undo последнего действия в редакторе.
- Экспорт в PDF через browser print.

### Что пока не реализовано

- Группировка столов для больших компаний.
- Копирование столов между планами отдельной кнопкой.
- Полноценный server-side export в PDF без browser print.

### Маршруты

- `/floor-plans`:
  бизнес-кабинет, загрузка схемы и редактор столов.
- `/venue/:venueId/tables`:
  клиентская интерактивная схема с доступностью столов.

### Примеры API-запросов

Ниже примеры вызовов Supabase Storage/REST/RPC, которые соответствуют модулю планов.

#### 1. Upload floor plan image

```bash
curl -X POST "$SUPABASE_URL/storage/v1/object/venue-floor-plans/$VENUE_ID/floor-plans/main-hall.png" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  -H "x-upsert: false" \
  --data-binary "@/absolute/path/to/main-hall.png"
```

#### 2. Create floor plan record

```bash
curl -X POST "$SUPABASE_URL/rest/v1/venue_floor_plans?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data "[
    {
      \"venue_id\": \"$VENUE_ID\",
      \"name\": \"Основной зал\",
      \"image_path\": \"$PUBLIC_IMAGE_URL\",
      \"width\": 1920,
      \"height\": 1080
    }
  ]"
```

#### 3. Create venue table

```bash
curl -X POST "$SUPABASE_URL/rest/v1/venue_tables?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data "[
    {
      \"floor_plan_id\": \"$FLOOR_PLAN_ID\",
      \"table_number\": \"A1\",
      \"capacity\": 4,
      \"x_position\": 18,
      \"y_position\": 32,
      \"width\": 14,
      \"height\": 10,
      \"shape\": \"rectangle\",
      \"notes\": \"У окна\",
      \"is_active\": true
    }
  ]"
```

#### 4. Update venue table

```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/venue_tables?id=eq.$TABLE_ID&select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data '{
    "x_position": 24,
    "y_position": 35,
    "notes": "VIP"
  }'
```

#### 5. Delete venue table

```bash
curl -X DELETE "$SUPABASE_URL/rest/v1/venue_tables?id=eq.$TABLE_ID" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 6. Get all plans with nested tables

```bash
curl "$SUPABASE_URL/rest/v1/venue_floor_plans?select=*,venue_tables(*)&venue_id=eq.$VENUE_ID&order=created_at.asc" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 7. Get available tables for booking

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/list_available_venue_tables" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "p_venue_id": "'"$VENUE_ID"'",
    "p_booking_date": "2026-03-29",
    "p_start_time": "19:00",
    "p_guests": 4,
    "p_duration_minutes": 120
  }'
```

#### 8. Create table booking

```bash
curl -X POST "$SUPABASE_URL/rest/v1/venue_table_bookings?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data "[
    {
      \"venue_table_id\": \"$TABLE_ID\",
      \"user_id\": \"$USER_ID\",
      \"guest_count\": 4,
      \"booking_date\": \"2026-03-29\",
      \"start_time\": \"19:00\",
      \"end_time\": \"21:00\",
      \"notes\": \"День рождения\"
    }
  ]"
```

### Роли и доступ

- Есть две продуктовые роли: `owner` (в коде `admin`/business-портал) и `user`.
- `owner` управляет площадкой/комнатами/инвайтами и видит бронирования своего заведения.
- `user` работает с marketplace-каталогом, бронированиями и профилем.
- Инвайты остаются дополнительной функцией для подключения людей к заведению.

### Заведения, комнаты, membership

- Membership уникален по паре `(venue_id, user_id)`.
- Заведения и комнаты публично видны в каталоге (включая гостей без авторизации).
- Membership используется для командного доступа и приглашений, но не как базовый доступ к каталогу.
- Вместимость комнаты должна быть `> 0`.

### Бронирования

- Бронь имеет статусы `active` или `cancelled`.
- Проверка пересечений обязательна:
  - в БД через constraint `bookings_no_overlap` (для `status = 'active'`);
  - на клиенте при создании/редактировании.
- `start_time` всегда должен быть меньше `end_time`.
- В пользовательском UI шаг времени для слотов: 15 минут.
- Пользователь не может создать бронь на прошедшую дату.

### Приглашения

- У приглашения есть токен, статус (`pending`/`connected`), лимит использований (`max_uses`), срок (`expires_at`) и возможность отзыва (`revoked_at`).
- Инвайт может быть привязан к конкретному `invitee_user_id` и/или email.
- При активации инвайта:
  - создается membership (если его еще нет),
  - увеличивается `uses`,
  - выставляется статус `connected`.

### Профиль и безопасность

- Email в `profiles` нельзя менять (`prevent_profile_email_update` trigger).
- Для основных таблиц включен RLS, доступ определяется через политики для владельцев/админов/участников.
- Поле `app_env` выставляется на стороне БД через `resolve_request_app_env()` и `app.settings.app_env`.

## Примечания по репозиторию

- `node_modules/` и `dist/` не должны храниться в Git.
