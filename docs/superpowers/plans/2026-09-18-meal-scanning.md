> **Status: proposal, not built.** Drafted 2026-09-18 for the organisers' meeting on
> 2026-09-19. Nothing below exists in the code yet — build only once approved.

# Meal scanning at the catering stations

## Context

Last year every student got a stamp at registration and showed it at the catering
stations. The stamp itself wasn't the problem — **the volunteers were**: some didn't
check or take stamps, so some students got a 2nd or 3rd plate before everyone
had a 1st. Rule for the night: **one meal per ticket until every table is
served, then seconds open for everyone.** The caterer bills per ticket sold, so
no exact plate count is needed.

Decided with the user:
- Scan the ticket QR at each meal station (one phone + one volunteer per station).
  The screen enforces the rule, not the volunteer's attention.
- An **admin switch "Seconds open"**. Once it's flipped, repeats are allowed but still logged.
- **No QR at the station → send them to the admin desk.** No name search at the stations.

## Design

**Reuse the door scanner. Add a "meal" mode chosen at setup.** It's the same page
(`/admin/scan`, which staff can already reach), the same camera/decoder, the same
offline-first queue and manifest, and the same full-screen result panels. When
naming the phone, the volunteer picks **Door** or **Meal station** (e.g. `meal-1`).

**Meal scans get their own table, `meal_scans`, not the `scans` table.** Every
existing reader treats a `scans` row with `result = 'ok'` as attendance: the raffle
pool, certificates, the Attendance page, the manifest's `checkedInAt`, Sheets sync
and the xlsx export. Mixing meals in would quietly break all of them.

**Meal results** (pure `resolveMeal`, unit tested):
| Result | When | Panel |
|---|---|---|
| `served` | valid ticket, checked in at the door, no meal yet | green **"Serve one meal"** + name |
| `repeat` | already had a meal, seconds closed | red **"Already had their meal"** + time, "Seconds haven't started — ask them to wait" |
| `seconds` | already had a meal, seconds open | blue **"Seconds"** + name |
| `not_checked_in` | real ticket, never scanned at the door | amber **"Not checked in at the door"**, "Send them to the door first" |
| `invalid` | not a ticket | red **"Not a valid ticket"**, "Send them to the admin desk" |

"Checked in at the door first" also blocks a screenshot of an absent friend's QR.

**Across stations:** the manifest now also carries each ticket's earliest
`mealServedAt` and the `secondsOpen` flag. The existing 20-second refresh spreads
them to every phone. A repeat at the *same* station is caught instantly. Between
two stations it takes up to ~20 seconds, or less if the volunteer presses Refresh.

**Order safety (lesson from 2026-09-18):** the code must keep working before the
migration is pasted. The manifest's meal lookups are **non-fatal**: if
`meal_scans`/`event_settings` don't exist yet, it treats them as empty/closed and
the **door scanner keeps working**. Paste and push back-to-back anyway.

## Changes

### 1. Migration `supabase/migrations/0016_meal_scans.sql`
- `meal_scans`, which mirrors `scans`: `id uuid pk` (client-generated, idempotent re-sync),
  `registration_id` fk nullable, `code_scanned`, `scanned_at`, `synced_at default now()`,
  `device_label`, `result text check in ('served','repeat','seconds','not_checked_in','invalid')`.
  Index on `(registration_id, result)`. RLS on, authenticated read only.
- `event_settings`: a single row (`id boolean pk default true check (id)`), with
  `meal_seconds_open boolean not null default false`, `updated_at`, `updated_by`. Seeded with one row.

### 2. Pure logic (TDD, no `server-only`)
- `src/lib/meals/resolve.ts` + test: `resolveMeal(raw, index, servedLocally, secondsOpen)`.
  Reuses `normalizeScannedCode` and `buildIndex` from `src/lib/scans/resolve.ts`.
- `src/lib/meals/report.ts` + test: `summarizeMeals(rows, checkedInCount)`. Returns
  served / still to serve / repeats blocked / seconds, plus per-station counts.

### 3. Shared scanner plumbing
- `src/lib/scans/manifest.ts`: `ManifestEntry.mealServedAt`, `Manifest.secondsOpen`.
- `src/lib/scans/queries.ts` `approvedManifest()`: adds the earliest `served` time per
  registration and the seconds flag. Both are wrapped non-fatally (see above).
- `src/lib/scans/store.ts`: `DB_VERSION` 2 adds a `meal-served` and `meal-queue` store.
  Existing phones upgrade in place, and door and meal data never mix on one phone.

### 4. Server
- `src/lib/meals/queries.ts` (server-only): `recordMealScans` (same idempotent upsert as
  `recordScans`), `allMealScans`, `getSecondsOpen`, `setSecondsOpen`.
- `src/app/api/meal/sync/route.ts`: a copy of `/api/scan/sync` with the meal results enum. Signed-in only.

### 5. Scanner UI — `src/app/admin/scan/scanner.tsx`
- Setup: "Name this scanner" plus a **Door / Meal station** choice. Both are saved in localStorage.
- A small **Change** button in the top bar goes back to setup, so the same phone can move from door to food.
- Meal mode resolves with `resolveMeal`, queues to `meal-queue`, and syncs to `/api/meal/sync`.
  The top bar shows **"Seconds open"** once the manifest says so.
- Meal result panels go in `meal-result.tsx`, to keep the file readable.
  They use semantic colours only, per DESIGN.md §5. Blue is new, and only for "Seconds".

### 6. Admin Meals page — `/admin/meals` (admin-only, in the admin nav)
- Cards: **Checked in**, **First meals served**, **Still to be served** (checked in − served),
  **Repeats blocked**, **Seconds served**. "Still to be served" hitting 0 is how you know every table
  is done.
- **Per station** table: served / repeats blocked / seconds. This shows which station lets repeats through.
- **Seconds open** switch (`requireAdmin`, with a confirm). It's logged as `meal_seconds_opened`/`closed`.
- Recent meal scans list, same shared `Table`.

### 7. Docs
`context/SCHEMA.md` (both tables, why meals aren't in `scans`), `context/PRD.md` §4.

## Reused
`startDecoder` (camera), `buildIndex`/`normalizeScannedCode`, the IndexedDB queue
pattern in `store.ts`, `recordScans`' idempotent upsert, `Table`/`Stat`/`Badge`,
`useSetNavHidden`, `requireAdmin`, `logActivity`.

## Verification
1. `npm test` (resolveMeal, summarizeMeals), `npm run build`, `npm run lint`.
2. **Before pasting 0016:** the door scanner still loads and scans. This proves the order-safety.
3. Paste `0016` and push together.
4. Two-phone rehearsal on production with a test ticket:
   - Scan at the door. Then, on phone A in meal mode: **Serve** → scan again → **Already had their meal**.
   - Phone B within ~20s, or after Refresh: **Already had their meal**.
   - A test ticket never door-scanned → **Not checked in**.
   - Flip **Seconds open** on /admin/meals → after a refresh, a repeat shows **Seconds**.
   - Airplane mode on phone A: it still serves and blocks locally, and syncs once back online.
   - /admin/meals counts and per-station table match what was scanned.
5. Void the test ticket.
