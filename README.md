# Workspace Booking App (Supabase)

Frontend для бронирования комнат (React + TypeScript + Vite) с хранением данных в Supabase (Auth + Postgres + RLS).

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
3. В Supabase проверьте Auth -> Providers -> Email:
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

## Бизнес-правила

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
