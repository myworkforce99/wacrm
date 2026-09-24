# Fork Merge Notes

This file contains quick reminders on how to handle `git` merge conflicts when you pull updates from the upstream repository (`git pull upstream main`). Since this fork contains custom fixes for browser extensions and adblockers, you will occasionally need to resolve conflicts.

## 1. Hydration Fix (`src/app/layout.tsx`)

**What we changed:** We completely removed the `<head>` tag and moved the Next.js `theme-boot` script to be the first child of the `<body>` tag. This prevents browser extensions (like adblockers or password managers) from causing React hydration mismatches when they inject their own scripts.
**How to merge:** If upstream modifies `layout.tsx` (e.g. adding new metadata tags), **keep our structure**. Ensure `theme-boot` stays inside `<body>` and avoid wrapping it in `<head>` or `<Script>`.

## 2. Adblocker Fix (Presence Heartbeat)

**What we changed:** We renamed the database RPC and the client-side call from `touch_presence` to `sync_profile_data` in `supabase/migrations/024_member_presence.sql` and `src/components/presence/presence-heartbeat.tsx`. The word "presence" often gets blocked by strict adblockers (like Brave Shields).
**How to merge:** If upstream changes the heartbeat interval or logic, accept their logic but **ensure the RPC name remains `sync_profile_data`** so it doesn't get blocked again.

## 3. Database UUID Functions (`supabase/migrations/*.sql`)

**What we changed:** Replaced all outdated `uuid_generate_v4()` calls with native Postgres `gen_random_uuid()` in early migration files (001, 006, 009, 010, 017, 027, 035) to fix `supabase db reset` errors.
**How to merge:** Upstream should rarely touch these historical files. If they do, it's safe to **Accept Current (Local) Changes** to keep `gen_random_uuid()`.

## 4. Translations & i18n (`messages/*.json`)

**What we changed:** Added missing `flows` and `aiAgents` translations. To satisfy the `wacrm` test suite which strictly requires all languages to have the exact same keys as `en.json`, we created an auto-sync script.
**How to merge:** If upstream adds new translations, accept their changes. Whenever you add your own custom strings to `en.json`, just run:

```bash
npm run i18n:sync
```

This will automatically copy your English text to Spanish, Korean, and Portuguese, ensuring you never get CI test failures or runtime crashes.
