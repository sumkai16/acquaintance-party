# SCHEMA.md — Database Schema

Source of truth: the migration files under `supabase/migrations/`. This
file is a fast reference — if the two disagree, the migration files are
right and this needs updating.

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
| student_id | text | NOT NULL, non-blank | Added in `0005_student_id_and_walk_in.sql` — the real anti-spam identity key; email alone let one student submit repeatedly with a new address each time |
| year_level | text | NOT NULL | Free text, validated at the app layer against `YEAR_LEVELS` in `schema.ts` |
| section | text | NOT NULL | |
| email | text | NOT NULL | Lowercased at the app layer before insert |
| payment_method | text | NOT NULL, `'online'` \| `'walk_in'` | Added in `0005` — `online` goes through checkout + review; `walk_in` is a cash sale an admin enters directly at `/admin/walk-in`, approved immediately |
| gcash_reference | text | nullable, **UNIQUE** (`registrations_gcash_reference_key`) | The anti-fraud lever for online payments — one real GCash transaction, one ticket. Normalized (digits only, no spaces/dashes) before insert. `NULL` for a walk-in row; Postgres treats every `NULL` as distinct, so any number of walk-ins coexist under this index |
| receipt_path | text | nullable | Key into the private `receipts` storage bucket, not a URL. `NULL` for a walk-in row — no receipt to review |
| amount | integer | NOT NULL, `> 0` | **Centavos**, never a float |
| status | `registration_status` enum | NOT NULL, default `pending` | `pending` \| `approved` \| `rejected` |
| reject_reason | text | nullable | Shown to the student on their ticket page. Also holds the reason when an admin voids an *approved* row to free its student ID for resubmission — see below |
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
- `payment_fields_match_method` (`0005`) — `online` requires both
  `gcash_reference` and `receipt_path`; `walk_in` requires neither.

**Indexes:**
- `registrations_gcash_reference_key` — unique, the online fraud lever above
- `registrations_status_created_idx` — `(status, created_at desc)`, serves
  the admin review queue's "pending, oldest first" list
- `registrations_email_idx` — `lower(email)`, serves admin search
- `registrations_student_id_active_key` (`0005`) — unique on `student_id`
  **where `status <> 'rejected'`**. This is the actual one-active-
  registration-per-student rule: a rejected row falls outside the index, so
  it never blocks a resubmission. There are two ways a row ends up
  rejected — the normal Review Queue reject (still pending-only, in
  `admin/review/actions.ts`), or `voidRegistration` in
  `admin/registrations/actions.ts`, which does the same update but also
  accepts an *approved* row, for the case where a student legitimately
  needs a do-over after their ticket already went through. Both paths land
  on the same `rejected` state, so the index needs no separate concept of
  "reactivated."

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

## raffle_extra_entrants

Added in the same migration. The escape hatch for someone the scanner missed
or a name from outside the ticket system (a walk-in list, imported from
Excel). The scanned-in pool built from `registrations`/`scans` stays the
default and the primary eligibility path — this table only ever supplements
it, via an explicit admin action at `/admin/raffle`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| full_name | text | NOT NULL, 2–120 chars trimmed | |
| year_level | text | nullable | Optional — not every extra entrant has one on file |
| section | text | nullable | Optional |
| source | text | NOT NULL, `manual` \| `import` | How the row was added |
| added_by | uuid | NOT NULL, FK → `auth.users(id)` | |
| created_at | timestamptz | NOT NULL, default `now()` | |

## raffle_draws

One row per draw, including redraws. Added in `0002_raffle.sql`.
`prize_key`/`prize_name` were dropped in `0004_raffle_remove_prizes.sql`,
alongside the `raffle_prizes` table itself — prizes aren't tracked in the
app at all now. The MC announces what's being raffled off verbally; the
software's only job is picking a winner's name, in sequence, all night.
Only the most recently drawn row (across the whole night, not scoped to
anything) is ever redrawable — see `latestDraw()` in `src/lib/raffle/draw.ts`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| winner_registration_id | uuid | NOT NULL, **no FK** | Either a `registrations.id` or a `raffle_extra_entrants.id` — see below |
| finalists | jsonb | NOT NULL, array of 1–12 | Snapshots `{registrationId, fullName, yearLevel, section, source}` per finalist, not bare ids — see below |
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

**Why `winner_registration_id` has no FK:** it originally referenced
`registrations(id)`. An extra entrant (`raffle_extra_entrants`) has no such
row, so a winner drawn from one couldn't satisfy that FK — dropped in
`0003_raffle_prizes_and_entrants.sql`, not widened, since a single FK column
can't reference two tables. `finalists` already snapshots the winner's
display data directly, so the FK was never load-bearing for anything the
app reads.

**Indexes:** `raffle_draws_winner_idx` on `winner_registration_id`, and a
partial unique index on `supersedes` so one draw can be superseded at most
once — the history stays a chain, not a tree nobody can read back.

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
create policy "admins read raffle_extra_entrants" on raffle_extra_entrants
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
