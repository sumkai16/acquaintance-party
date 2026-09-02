# SCHEMA.md — Database Schema

Source of truth: the migration files under `supabase/migrations/`
(`0001_init.sql`, `0002_raffle.sql`). This file is a fast reference — if the
two disagree, the migration files are right and this needs updating.

Applied by hand into the hosted Supabase project (no CLI/Docker on this
machine) — see `docs/setup/supabase.md` §6 for the exact steps, and follow
the same process for any future migration file.

## registrations

One registration is one ticket — a fixed single price with no group
purchasing means there's no separate orders table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| full_name | text | NOT NULL, 2–120 chars trimmed | |
| year_level | text | NOT NULL | Free text, validated at the app layer against `YEAR_LEVELS` in `schema.ts` |
| section | text | NOT NULL | |
| email | text | NOT NULL | Lowercased at the app layer before insert |
| gcash_reference | text | NOT NULL, **UNIQUE** (`registrations_gcash_reference_key`) | The core anti-fraud lever — one real GCash transaction, one ticket. Normalized (digits only, no spaces/dashes) before insert |
| receipt_path | text | NOT NULL | Key into the private `receipts` storage bucket, not a URL |
| amount | integer | NOT NULL, `> 0` | **Centavos**, never a float |
| status | `registration_status` enum | NOT NULL, default `pending` | `pending` \| `approved` \| `rejected` |
| reject_reason | text | nullable | Shown to the student on their ticket page |
| ticket_code | text | nullable, UNIQUE | 12-char opaque code, generated only on approval |
| created_at | timestamptz | NOT NULL, default `now()` | |
| reviewed_at | timestamptz | nullable | |
| reviewed_by | uuid | FK → `auth.users(id)`, nullable | The admin who approved/rejected |

**Check constraints — do not work around these from application code:**
- `ticket_code_matches_status` — `status = 'approved'` requires
  `ticket_code IS NOT NULL`, and vice versa. Verified live against the
  database: an insert attempting `status='approved', ticket_code=null`
  raises `23514` on this exact constraint.
- `rejection_has_reason` — `status = 'rejected'` requires a non-empty
  `reject_reason`. A student is never shown a bare rejection with no
  explanation.

**Indexes:**
- `registrations_gcash_reference_key` — unique, the fraud lever above
- `registrations_status_created_idx` — `(status, created_at desc)`, serves
  the admin review queue's "pending, oldest first" list
- `registrations_email_idx` — `lower(email)`, serves admin search

## scans

Append-only log, deliberately separate from a boolean on `registrations` —
offline scanners sync late, and reconciling what actually happened at the
door needs the full history, not a single flag that the last sync
overwrites.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| registration_id | uuid | FK → `registrations(id)` ON DELETE CASCADE, nullable | Null when the scanned code matched nothing |
| code_scanned | text | NOT NULL | The raw code read by the scanner, kept even on a miss |
| scanned_at | timestamptz | NOT NULL | Device clock at scan time |
| synced_at | timestamptz | NOT NULL, default `now()` | Server clock when the scan record landed — the gap between this and `scanned_at` shows offline lag |
| device_label | text | NOT NULL | Per-scanner identifier, e.g. `door-1` |
| result | `scan_result` enum | NOT NULL | `ok` \| `duplicate` \| `invalid` |

Written by `recordScans()` in `src/lib/scans/queries.ts`, called from
`POST /api/scan/sync`. The client generates each row's `id` (a UUID), and the
insert is an `upsert(..., { onConflict: "id", ignoreDuplicates: true })` —
the scanner retries a queued batch blindly on a 15s interval, so a re-sync
must be a no-op, not a duplicate row or an error.

`approvedManifest()` also *reads* this table — for every approved
registration it finds the earliest `scanned_at` among rows with
`result = 'ok'` and attaches it to that ticket's manifest entry as
`checkedInAt`. This is what lets a second device recognize a ticket another
device already admitted, as long as both are online; a real signal blackout
is the one case it can't cover.

## raffle_draws

One row per draw, including redraws. Added in `0002_raffle.sql`.

**There is no `prizes` table** — the spec described one, but prizes live in
`RAFFLE_PRIZES` in `src/lib/config/event.ts` instead. A short list that
changes twice does not need a schema and a CRUD screen. A draw references a
prize by its config `key` and snapshots the name.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| prize_key | text | NOT NULL, non-empty | Matches a `key` in `RAFFLE_PRIZES`. Effectively append-only once the event starts — renaming one orphans its draws |
| prize_name | text | NOT NULL, non-empty | Snapshot, so editing the config never rewrites history |
| winner_registration_id | uuid | NOT NULL, FK → `registrations(id)` | Always one of `finalists` |
| finalists | jsonb | NOT NULL, array of 1–12 | Snapshots `{registrationId, fullName, yearLevel, section}` per finalist, not bare ids — see below |
| pool_size | integer | NOT NULL, `> 0` | Eligible students actually drawn from, after exclusions |
| drawn_at | timestamptz | NOT NULL, default `now()` | Server clock |
| drawn_by | uuid | NOT NULL, FK → `auth.users(id)` | The admin who ran the draw |
| is_redraw | boolean | NOT NULL, default false | |
| supersedes | uuid | FK → `raffle_draws(id)`, nullable, UNIQUE where set | The draw this replaced |

**Why `finalists` snapshots rather than storing ids:** this row records what
was announced on stage, not a live view. A past draw redisplays with no join
— which is what lets the projector survive a connection drop — and a later
name correction never silently changes what the emcee said. The winner's
display data is read out of this snapshot by matching
`winner_registration_id`.

**Check constraints:**
- `finalists_is_small_array` — `finalists` must be a JSON array of 1 to 12
  entries. A row with no shortlist did not come from a draw.
- `redraw_has_supersedes` — `is_redraw` is true exactly when `supersedes` is
  set. A redraw must say what it replaced; a fresh draw must not point
  anywhere.

**One invariant the database cannot enforce:** "the winner is one of the
finalists" needs a subquery, which Postgres forbids in `CHECK`. It holds
because `drawFromPool` in `src/lib/raffle/draw.ts` picks the winner out of
the finalists it returns, and `recordDraw` writes both together. A row
hand-written in the SQL editor could still break it; `allDraws()` logs and
skips such a row rather than rendering an undefined name.

**Indexes:** `raffle_draws_prize_key_idx` on `(prize_key, drawn_at desc)`,
`raffle_draws_winner_idx` on `winner_registration_id`, and a partial unique
index on `supersedes` so one draw can be superseded at most once — the
history stays a chain, not a tree nobody can read back.

## Row-level security

RLS is **on** for both tables. Every policy targets `authenticated` (i.e.
admins — public signup is disabled, see `docs/setup/supabase.md` §3) and
`anon` gets nothing:

```sql
create policy "admins read registrations" on registrations
  for select to authenticated using (true);
create policy "admins update registrations" on registrations
  for update to authenticated using (true) with check (true);
create policy "admins read scans" on scans
  for select to authenticated using (true);
create policy "admins read raffle_draws" on raffle_draws
  for select to authenticated using (true);
```

No `insert` policy exists for any of these tables on any role — all inserts go
through the service-role client from server actions, which bypasses RLS
entirely. This is deliberate: see `context/RULES.md` §Security.

## Storage

`receipts` bucket, **private**. Objects are keyed
`<year>/<uuid>.<ext>` (see `submitRegistration` in
`src/app/checkout/actions.ts`), never a guessable path. Admins read receipt
images only via `signedReceiptUrl()`, a 10-minute signed URL — there is no
public read path.
