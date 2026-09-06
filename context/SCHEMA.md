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
| evaluation_invited_at | timestamptz | nullable | Added in `0006_evaluation.sql`. When the post-event evaluation email went out. `NULL` is the queue: the admin send picks recipients by this being null, so pressing the button again retries failures and catches late-syncing scans without emailing anyone twice |

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
  the Payments page's "pending, oldest first" list
- `registrations_email_idx` — `lower(email)`, serves admin search
- `registrations_student_id_active_key` (`0005`) — unique on `student_id`
  **where `status <> 'rejected'`**. This is the actual one-active-
  registration-per-student rule: a rejected row falls outside the index, so
  it never blocks a resubmission. There are two ways a row ends up
  rejected — the normal Payments reject (still pending-only, in
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

## evaluations

Added in `0006_evaluation.sql`. One row per attendee who filled in the
post-event evaluation. Submitting it is what unlocks their certificate of
attendance at `/certificate/<registration id>`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| registration_id | uuid | NOT NULL, **UNIQUE**, FK → `registrations(id)` ON DELETE CASCADE | The unique index *is* the one-submission-per-attendee rule — a double-tap on Submit races here and loses with `23505`, which `saveEvaluation()` reads as "already submitted" and turns into a redirect to the certificate |
| form_version | text | NOT NULL | Which draft of the questions produced these answers. The questions live in `src/lib/evaluation/questions.ts`, not the database |
| answers | jsonb | NOT NULL | Keyed by question id. Ratings are numbers, choices are the option string, skipped free text is `null`. jsonb rather than a column per question so the draft questionnaire can change without a migration |
| submitted_at | timestamptz | NOT NULL, default `now()` | |

**Eligibility is not stored here.** "Attended" is derived the same way the
raffle and the attendance dashboard derive it — at least one `scans` row with
`result = 'ok'`. Both gates (scanned in, and evaluation submitted) live in
`certificateFor()` in `src/lib/certificates/data.ts`, so the page, the PNG
route, the PDF route and the email can never disagree about who gets one.

Responses are linked to the registration so a duplicate can be rejected and
the certificate can be gated — but `/admin/evaluations` shows totals only, and
lists the written answers without names.

## raffle_extra_entrants

Added in the same migration as `raffle_draws`. The escape hatch for someone the scanner missed
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

## profiles

Added in `0007_staff_roles_and_cash_remittance.sql`. One row per Supabase
Auth user — the role (`admin` | `staff`) behind every `/admin/*` route gate.
Accounts are still created by hand in the dashboard (no signup); the
`profiles` row is a second by-hand insert alongside it — see
`docs/setup/supabase.md` §5. A signed-in user with no matching `profiles`
row is treated as unprovisioned, not as admin-by-default — the opposite
default of the pre-role system, where any signed-in user was an admin.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE | |
| full_name | text | NOT NULL, 2–120 chars trimmed | Displayed everywhere an acting user's name is shown — activity logs, "Added By," the staff dashboard greeting |
| role | `user_role` enum | NOT NULL, default `staff` | `admin` \| `staff` |
| created_at | timestamptz | NOT NULL, default `now()` | |

## cash_remittances

Added in the same migration. A staff member's request to hand their
collected walk-in cash to Admin. Approving one is the only event that moves
money from "staff cash on hand" to "admin current collection" — see
`src/lib/cash/queries.ts` and `src/lib/cash/balances.ts` for how every
dashboard number derives from this table plus `registrations`, rather than
a separately maintained balance.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | Displayed truncated (first 8 chars, uppercased) as the "Remittance ID" — no separate human-readable sequence |
| staff_id | uuid | NOT NULL, FK → `auth.users(id)` | |
| amount | integer | NOT NULL, `> 0` | Centavos, never a float |
| status | `remittance_status` enum | NOT NULL, default `pending` | `pending` \| `approved` \| `rejected` |
| submitted_at | timestamptz | NOT NULL, default `now()` | |
| approved_at | timestamptz | nullable | |
| approved_by | uuid | FK → `auth.users(id)`, nullable | The admin who approved it |
| rejection_reason | text | nullable | |

**Check constraints:**
- `remittance_rejection_has_reason` — `status = 'rejected'` requires a
  non-empty `rejection_reason`, same reasoning as
  `registrations.reject_reason`.
- `approval_fields_match_status` — `status = 'approved'` requires both
  `approved_at` and `approved_by`; any other status requires neither.
  Backstops `approveRemittance()` the same way `ticket_code_matches_status`
  backstops `approveRegistration()`.

**The double-approval guard is not a constraint — it's the shape of the
`UPDATE` itself.** `approveRemittance()`/`rejectRemittance()`
(`src/lib/remittances/queries.ts`) both filter `.eq("status", "pending")` in
the same statement that sets the new status. Postgres commits this as one
atomic operation, so two concurrent approve calls can't both match the same
still-pending row — the second one simply matches nothing, which the app
reads as "already resolved" rather than a race.

**Indexes:** `cash_remittances_staff_idx` on `(staff_id, status)` (a staff
member's own balance), `cash_remittances_status_idx` on
`(status, submitted_at desc)` (Admin's pending queue).

## activity_logs

Added in the same migration. Append-only audit trail — every login, logout,
walk-in sale, payment approval/rejection, void, and remittance action writes
one row. No `UPDATE` or `DELETE` policy exists for any role; there is no
edit or delete affordance anywhere in the UI either.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| user_id | uuid | FK → `auth.users(id)`, nullable | The acting account |
| activity_type | text | NOT NULL | One of `ACTIVITY_TYPES` in `src/lib/activity/types.ts` — not a DB enum, so a new activity type needs no migration |
| description | text | NOT NULL | Built at write time, embedding the student's name/ID directly — this is what lets the admin activity log's search box match a student without joining back to `registrations` |
| registration_id | uuid | FK → `registrations(id)` ON DELETE SET NULL, nullable | Added `on delete set null` in `0008` — the log row is the append-only record and must survive the registration it describes being deleted (e.g. voided test data), not block the delete |
| remittance_id | uuid | FK → `cash_remittances(id)` ON DELETE SET NULL, nullable | Same reasoning as `registration_id` |
| amount | integer | nullable | Centavos |
| created_at | timestamptz | NOT NULL, default `now()` | |

**Indexes:** `activity_logs_user_idx` on `(user_id, created_at desc)` (a
staff member's own log), `activity_logs_type_idx` on
`(activity_type, created_at desc)`, `activity_logs_registration_idx` on
`registration_id`.

## Row-level security

RLS is **on** for every table. Every policy targets `authenticated` (i.e.
any signed-in user — public signup is disabled, see
`docs/setup/supabase.md` §3) and `anon` gets nothing:

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
create policy "admins read evaluations" on evaluations
  for select to authenticated using (true);
create policy "authenticated read profiles" on profiles
  for select to authenticated using (true);
create policy "authenticated read cash_remittances" on cash_remittances
  for select to authenticated using (true);
create policy "authenticated read activity_logs" on activity_logs
  for select to authenticated using (true);
```

**No `insert`/`update` policy exists on `profiles`, `cash_remittances`, or
`activity_logs` for any role, on purpose.** Staff-vs-admin scoping (a staff
member seeing only their own remittances and activity log) is enforced in
`src/lib/*/queries.ts` — filtering by the caller's own id in the query
itself — not in an RLS policy. A policy that checks `profiles.role` to
decide who can read `profiles` would also be a recursive-policy trap; see
`context/RULES.md` for why every write already goes through a server action
holding the service-role key, which is the actual security boundary here.

No `insert` policy exists for any of these tables on any role — all inserts go
through the service-role client from server actions, which bypasses RLS
entirely. This is deliberate: see `context/RULES.md` §Security.

`evaluations` is the clearest case for that rule: the writer is an
unauthenticated student, not an admin, and it still gets no `anon` policy.
`submitEvaluation` re-derives their eligibility server-side on every submit
and writes through the service-role client. If a feature seems to need an
`anon` insert policy, that's the wrong layer.

## Storage

`receipts` bucket, **private**. Objects are keyed
`<year>/<uuid>.<ext>` (see `submitRegistration` in
`src/app/checkout/actions.ts`), never a guessable path. Admins read receipt
images only via `signedReceiptUrl()`, a 10-minute signed URL — there is no
public read path.
