# Phase: Self-Service Account Deletion

**Status:** Done — verified in production 2026-06-25 (test account deleted, cascade confirmed: profiles/sessions/daily_threads/interactions all clean, zero orphans)
**Owner:** —
**Started:** 2026-06-24

---

## Goal & Rationale

Let a user delete their own account and all associated data from inside the app.

Today the only account action is "Sign out" in the profile dropdown
([HomeScreen.jsx](../src/components/home/HomeScreen.jsx)), and `useAuth` exposes only
`signUp` / `signIn` / `signOut`. Meanwhile the app's own legal copy already **promises**
deletion ([Support.jsx](../src/components/legal/Support.jsx),
[Privacy.jsx](../src/components/legal/Privacy.jsx)) — but it's currently a manual,
email-driven chore done by hand in the Supabase console.

Self-service deletion closes that gap. It's also a hard requirement for any future
App Store / Play Store wrapper and is expected under GDPR/CCPA.

The schema is already deletion-ready: every table (`profiles`, `sessions`,
`daily_threads`, `interactions`) declares `references auth.users(id) on delete cascade`
([001_initial_schema.sql](../supabase/migrations/001_initial_schema.sql)), so deleting
the auth user wipes all their data atomically — **no new migration required.**

---

## Scope

**In:**
- Self-service, immediate **hard delete** via `auth.admin.deleteUser` (cascade handles data).
- Type-email-to-confirm UX before deletion.
- New serverless endpoint to hold the service-role key off the client.

**Out:**
- Soft delete / grace period / recovery window.
- Data export ("download my data") — separate future phase if needed.
- Admin-initiated deletion of other users.

---

## Decisions

- **Confirmation UX:** user must type their own email address to enable the Delete button.
- **Delete type:** immediate hard delete; no soft-delete, no new schema.

---

## Security Notes

- The Supabase **service-role key is server-only** — never `VITE_`-prefixed, never in
  the browser bundle. Lives only in the serverless function's env.
- **Self-only invariant:** the endpoint deletes **only the JWT subject's user id**
  (`auth.getUser(token).user.id`). It never reads a user id from the request body, so a
  caller can only ever delete themselves.
- Auth front-half mirrors the proven pattern in [api/chat.js](../api/chat.js).

---

## Task Checklist

- [x] `api/delete-account.js` — authenticated serverless endpoint; admin `deleteUser(user.id)`.
- [x] `SUPABASE_SERVICE_ROLE_KEY` documented in [.env.example](../.env.example) — still TODO: set in Vercel.
- [x] `deleteAccount()` helper added to [useAuth.js](../src/hooks/useAuth.js).
- [x] "Delete account" menu item + type-email-to-confirm modal in [HomeScreen.jsx](../src/components/home/HomeScreen.jsx).
- [x] CLAUDE.md "Current State" updated.

---

## Verification

1. **Build sanity:** `npm run build` — no import/lint breakage.
2. **Endpoint auth guards:**
   - `POST /api/delete-account` with no `Authorization` header → 401.
   - Malformed/expired token → 401.
3. **End-to-end (throwaway account):**
   - Sign up a disposable user → profile menu → **Delete account**.
   - Delete button stays disabled until the exact email is typed.
   - Confirm → app returns to landing/auth screen.
   - In Supabase: `auth.users` row gone **and** `profiles` / `sessions` /
     `daily_threads` / `interactions` rows for that `user_id` gone (cascade worked).
   - Signing back in with the same credentials fails.
4. **Self-only invariant:** endpoint ignores any body and only deletes the JWT's own user id.

---

## Operational Follow-up

- Add the real `SUPABASE_SERVICE_ROLE_KEY` to Vercel → Project Settings → Environment
  Variables before this works in production.
