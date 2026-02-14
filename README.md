# Workspace Booking App (Supabase)

React + TypeScript + Vite app with Supabase Auth + Postgres storage.

## 1. Supabase setup

1. Open your Supabase project: `https://pzbeulhxxfrhyzoimawm.supabase.co`.
2. In **Auth -> Providers -> Email**, disable email confirmation (so signup returns a session immediately).
3. In **SQL Editor**, run `/Users/iskandar/development/startups/app/supabase/schema.sql`.

## 2. Environment

Create `.env` (already prepared in this workspace) with:

```bash

```

## 3. Run

```bash
npm install
npm run dev
```

## Notes

- All app data (users/profile role, venues, rooms, memberships, bookings, invitations) is stored in Supabase.
- Local JSON API/server has been removed.
- Auth/session is in-memory only in the frontend (no persisted local auth storage).
- There are no seeded login credentials. Create users through `/register` (or Supabase Auth dashboard) before using `/login`.
