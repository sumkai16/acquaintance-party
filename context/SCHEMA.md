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
| amount | integer | NOT NULL, `> 0` | **Centavos**, never a float — the ticket price owed, always `EVENT.ticketPriceCentavos` |
| amount_paid | integer | NOT NULL, default 0 | Added in `0013`. Cash/GCash actually collected on this row — an admin-entered amount while `partial`, equal to `amount` once `approved`. Every cash/collected total sums this, not `amount`, so a partial payment sitting with a staffer isn't invisible before the balance is settled |
| status | `registration_status` enum | NOT NULL, default `pending` | `pending` \| `approved` \| `rejected` \| `partial` |
| reject_reason | text | nullable | Shown to the student on their ticket page. Also holds the reason when an admin voids an *approved* row to free its student ID for resubmission — see below |
| ticket_code | text | nullable, UNIQUE | 12-char opaque code, generated only on approval |
| created_at | timestamptz | NOT NULL, default `now()` | |
| reviewed_at | timestamptz | nullable | |
| reviewed_by | uuid | FK → `auth.users(id)`, nullable | The admin who approved/rejected |
| evaluation_invited_at | timestamptz | nullable | Added in `0006_evaluation.sql`. When the post-event evaluation email went out. `NULL` is the queue: the admin send picks recipients by this being null, so pressing the button again retries failures and catches late-syncing scans without emailing anyone twice |
| import_batch_id | uuid | FK → `import_batches(id)` ON DELETE SET NULL, nullable | Added in `0012`. Set only on tickets created by a Walk-in bulk import — see `import_batches` below |
| ticket_email_sent_at | timestamptz | nullable | Added in `0009_ticket_email.sql`. When the ticket QR email actually reached Resend. Same "null is the queue" shape as `evaluation_invited_at` — the Dashboard's **Send to N** button emails approved payees where this is null, and stamps a batch only after Resend accepts it. Exists because every approval email failed silently for weeks (no verified sending domain, see `docs/setup/resend.md`) with nothing recording who was missed |
| email_bounced_at | timestamptz | nullable | Added in `0018_email_bounced.sql`. Set by the Resend webhook when an email to this address bounced, failed or was suppressed (not on a spam complaint — that one arrived). Exists because a bounce also nulls `ticket_email_sent_at`, and null there means "never sent" too, so the Dashboard couldn't tell a dead address from an unsent one. Cleared when staff change the email (`updateRegistrationIdentity`) or a later send is accepted (`markTicketEmailSent`) |
| ticket_email_delivered_at | timestamptz | nullable | Added in `0019_ticket_email_delivered.sql`. Set by the Resend webhook's `email.delivered` event, and only for a send tagged `kind=ticket` (a send that actually carries the QR — see `src/lib/notify/email.ts`). `ticket_email_sent_at` alone only means Resend *accepted* the send; this is the confirmation it reached the mailbox server, which is what the Dashboard's "QR sent, not confirmed" vs. "QR delivered" markers key off. Cleared alongside `ticket_email_sent_at` on every resend (`markTicketEmailSent`, `clearTicketEmailSent`), so a stale confirmation from a previous attempt never survives a fix |

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
- `amount_paid_within_amount` (`0013`) — `amount_paid` is never negative and
  never more than `amount`.
- `partial_is_walk_in_underpaid` (`0013`) — `status = 'partial'` only ever
  happens on a `walk_in` row with `0 < amount_paid < amount`. Written as
  `status::text <> 'partial'` rather than comparing the enum directly, so it
  can be pasted in the same run as the `ADD VALUE` above it. Doesn't encode
  the flat minimum below — that's an app-layer rule, not a DB one, same as
  the section-matches-year-level check in `registrations/schema.ts`.

**`partial` is walk-in only** — there is no partial payment on an online
registration; checkout, Payments, and the online approve flow are
unchanged. A walk-in sale can be recorded with any admin-entered amount
(`createWalkInRegistration` with `partialAmountCentavos`,
`src/lib/registrations/queries.ts`), not a fixed split — staff type in
whatever the student actually hands over. It must be at least
`EVENT.partialPaymentMinCentavos` — a flat floor against an accidentally
tiny amount, not a percentage of the ticket price, since nothing about it
needs to scale if the price changes (`isValidPartialAmount()` in
`src/lib/registrations/partial.ts`, validated in
`admin/walk-in/actions.ts` before the insert), and strictly less than the
full price — equal or more is a full sale on the regular path instead. A
partial row gets `status = 'partial'`, `amount_paid` set to that entered
amount, and no `ticket_code` — no QR goes out. `completeWalkInBalance()`
settles the rest: same retry-on-collision ticket-code loop as
`approveRegistration`, filtered on `.eq("status", "partial")` as the race
guard, same as every other "second click is a no-op" action in this
codebase. The UI for this lives on `/admin/walk-in` (an "Outstanding
balances" list with a "Mark balance paid" button), not the Dashboard, since
staff — who take this cash — can't reach Find a registration.

**Cash attribution stays on the single `reviewed_by` set at creation** —
completing a balance does not reassign it. If a different staffer takes the
remaining payment, they hand that cash to the original collector or to
admin, the same one-collector assumption every walk-in sale already makes.
A per-payment ledger would lift this limit but is more than a two-payment
maximum needs.

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
  `admin/dashboard/actions.ts`, which does the same update but also
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
| audience | text | NOT NULL, default `'student'`, `'student'` \| `'faculty'` | Added in `0017`. Which pool this draw ran against — see below |

**Students and faculty are drawn separately, and `audience` is the whole
mechanism.** `allDraws(audience)` filters on it, which is what scopes
`latestDraw()` and `currentWinnerIds()` (`src/lib/raffle/pool.ts`) without
either of them knowing audiences exist — they already take a draws array. Get
this wrong and the bug is silent: drawing a faculty name makes the student
draw before it stop being redrawable, discovered at the podium. Defaulted
rather than backfilled, so the pre-`0017` insert in `recordDraw()` stayed
valid while the column landed ahead of the code.

## faculty_invitations

Added in `0017_faculty_raffle.sql`. One row per faculty member who opened the
letter at `/invitation` and ticked that they read it. That tick is both the
RSVP and the entry in the faculty giveaway.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | Doubles as the `RaffleEntrant.registrationId` for a faculty entrant — same as `raffle_extra_entrants`, which is why `raffle_draws.winner_registration_id` has no FK |
| full_name | text | NOT NULL, 2–120 chars trimmed | |
| department | text | nullable | Optional on the form. Shown as the winner's sub-line via `entrantDetail()` |
| letter_version | text | NOT NULL | Which wording they acknowledged — `LETTER_VERSION` in `src/lib/faculty/letter.ts`, the same reasoning as `evaluations.form_version`. `/admin/faculty` counts anyone sitting on an older one |
| acknowledged_at | timestamptz | NOT NULL, default `now()` | |
| created_at | timestamptz | NOT NULL, default `now()` | |

**Indexes:** `faculty_invitations_name_key` — unique on
`lower(btrim(full_name))`.

**That unique index is the duplicate rule, not a check in app code.** The QR
is shared rather than per-person, so a second submission races here and loses
with `23505`, which `recordAcknowledgement()` reports as `already_entered` —
a normal outcome the page turns into "you're already on the list," never an
error. Same shape as the index behind `saveEvaluation()`.

**No attendance gate.** Unlike students (`eligiblePool()` requires an `ok`
scan) a faculty member is eligible the moment they acknowledge, present or
not — an explicit choice on 2026-09-20, with the emcee redrawing an empty
chair as the accepted cost.

**There is no "hasn't opened it yet" list, and there cannot be.** One shared
QR means the app never learns who it was sent to. `/admin/faculty` shows who
came forward, not a tick-off against a faculty directory; that would need a
QR per person, which needs the roster up front.

**RLS is on with no policies at all**, same as `walk_in_drafts` — names and
departments are personal data. The public page writes through a server action
on the service-role client, exactly as `evaluations` does for an
unauthenticated student.

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

## expenses

Added in `0010_expenses.sql`. Admin-recorded money spent on the event —
`/admin/expenses`. The cash/GCash "remaining" figures on that page are
computed at read time (collected minus non-voided expenses, per method),
never written back to `registrations` or `cash_remittances` — no other
page's totals change because of an expense.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | |
| item_name | text | NOT NULL, 2–120 chars trimmed | |
| amount | integer | NOT NULL, `> 0` | Centavos, never a float |
| method | `expense_method` enum | NOT NULL | `cash` \| `gcash` |
| spent_at | timestamptz | NOT NULL | When the money was actually spent — admin-editable, defaults to now in the form |
| added_by | uuid | NOT NULL, FK → `auth.users(id)` | From the signed-in session, never a typed field — see `context/RULES.md` on trusting client input for an audit trail |
| created_at | timestamptz | NOT NULL, default `now()` | |
| voided_at | timestamptz | nullable | |
| voided_by | uuid | FK → `auth.users(id)`, nullable | |
| void_reason | text | nullable | |
| receipt_path | text | nullable | Added in `0011_expense_receipts.sql`. Key into the private `receipts` bucket (`expenses/<uuid>.<ext>`), not a URL. Optional — imported rows never have one. Viewed in the shared zoomable viewer (`src/app/admin/receipt-lightbox.tsx`), whose image src is `/admin/expenses/receipt/[id]` — that route mints a fresh 10-minute signed URL each time |

Rows can also arrive in bulk from an Excel import (`/admin/expenses`,
`import-actions.ts`) — `added_by` is the importing admin, and the batch
writes one summary `expense_added` activity row rather than one per
expense. `/admin/expenses/export` downloads every row (voided included) plus
a Summary sheet matching the page's cards.

**Check constraints:**
- `void_fields_consistent` — `voided_at`/`voided_by`/`void_reason` are all
  null or all set (with a non-empty reason), same shape as
  `cash_remittances.approval_fields_match_status`. An expense is voided,
  never deleted — the row and its reason stay in the audit trail.

**The double-void guard is not a constraint** — `voidExpense()`
(`src/lib/expenses/queries.ts`) filters `.is("voided_at", null)` in the same
`UPDATE` that sets it, the same atomic pattern `approveRemittance()` uses.

**Indexes:** `expenses_spent_idx` on `spent_at desc`.

## receipts

Added in `0014_receipts.sql`. One row per **payment**, not per registration —
a partial walk-in that pays twice has two receipts. Public at
`/receipt/<id>`, printed through the browser's own Save as PDF (no PDF
library, unlike the certificate).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | The unguessable half of the public link, same as a ticket id |
| number | integer | `generated always as identity`, UNIQUE | Displayed as `AR-<year paid>-<4 digits>` (`formatReceiptNumber()`). An identity column, not a count of rows: a number is never reused after a void, and two payments landing together can't draw the same one |
| registration_id | uuid | FK → `registrations(id)` ON DELETE SET NULL, indexed | Null only if the registration was hard-deleted; the receipt itself survives as the record |
| full_name / student_id / year_level / section | text | NOT NULL | **Snapshotted at issue time**, same reasoning as `raffle_draws.finalists` — a receipt records what was issued, so a later name correction can't rewrite a document the student already holds |
| amount | integer | NOT NULL, `> 0` | Centavos collected **by this payment**, not the ticket price |
| method | text | NOT NULL, `'gcash'` \| `'cash'` | Plain text, not an enum — one fewer migration if a third method ever appears |
| balance_after | integer | NOT NULL, `>= 0` | What was still owed after this payment. `> 0` is what makes the page say "partial payment" and hide the ticket code |
| received_by | uuid | FK → `auth.users(id)`, nullable | Whoever confirmed *this* payment: the approving admin (online), the staffer who took the cash, or whoever marked the balance paid. So a second collector is credited correctly on receipt #2, even though `registrations.reviewed_by` (and therefore cash attribution) stays with the first |
| paid_at | timestamptz | NOT NULL | When the money moved: `created_at` for online (the GCash was sent then, not when an admin got to it), the time of entry for walk-in |
| emailed_at | timestamptz | nullable | "Null is the queue," the same shape as `ticket_email_sent_at` — the Dashboard's **Receipts** card sends to everyone still null and stamps only after Resend accepts |
| created_at | timestamptz | NOT NULL, default `now()` | |

`0014` backfills one receipt per existing `approved`/`partial` row, ordered by
`paid_at`, all with `emailed_at` null — so every student who paid before
receipts existed lands in that backlog and gets the apology email.

**Issuing never blocks a sale.** `issueReceiptOrLog()`
(`src/lib/receipts/queries.ts`) returns the ids to link in the payment's email,
or writes a `receipt_failed` activity row and returns none. The cash is already
in hand by then; a missing receipt is fixable, a failed sale is not.

## import_batches

Added in `0012_import_batches.sql`. One row per confirmed Walk-in bulk
import. Exists because a staff member once imported the wrong file: every
row became an approved ticket, nothing recorded what file it was or linked
those tickets together, and the admin had to void them one by one.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | Generated in app code so the file key can use it before insert |
| uploaded_by | uuid | NOT NULL, FK → `auth.users(id)` | Staff or admin who confirmed the import |
| file_name | text | NOT NULL | Original name, used as the download filename |
| file_path | text | NOT NULL | Key in the private `receipts` bucket: `imports/<id>.xlsx` |
| created_count | integer | NOT NULL, default 0 | Tickets created |
| failed_count | integer | NOT NULL, default 0 | Checked rows that failed at insert (e.g. student ID already active) |
| created_at | timestamptz | NOT NULL, default `now()` | |
| voided_at / voided_by / void_reason | | nullable | Set together (`batch_void_fields_consistent`) by the first "Void this import" |

`registrations.import_batch_id` (uuid, FK → `import_batches(id)` ON DELETE
SET NULL, indexed) tags each ticket an import created. Null for single
walk-in sales, online checkout, and any import from before `0012`.

**Order matters in `confirmWalkInImport`** (`src/app/admin/walk-in/import-actions.ts`):
the batch row is inserted and the file uploaded *before* any ticket is
created; if the upload fails the batch is deleted and nothing is imported.
A batch that ends up creating zero tickets is deleted with its file.

**Voiding** (`voidImportBatch()` in `src/lib/import-batches/queries.ts`) is
one `UPDATE registrations … where import_batch_id = ? and status <> 'rejected'`
— the same change `voidRegistration` makes to a single row. Tickets voided
individually beforehand are untouched. It writes one `registration_voided`
activity row per ticket plus one `import_voided` summary. Admin-only:
`/admin/imports` sits outside `/admin/walk-in` on purpose, because the
layout's staff allowlist is a prefix match and would let staff into anything
under it.

The Walk-in **"Type a list"** screen (`confirmTypedWalkIns`) records through
this same table: it generates a small `.xlsx` from the typed rows
(`Typed entry <date time>.xlsx`) so the batch keeps a file like any upload,
and "Void this import" works on it unchanged.

## email_correction_requests

Added in `0020_email_correction_requests.sql`. One row per "my email is
wrong" request from `/find` — a student who typed the wrong email at
checkout can't be matched by `/find`'s own exact-match lookup, since the
email is exactly what's wrong. Exists as its own table rather than another
`activity_logs` row (which the feature briefly used) because staff needed a
queue with an open/resolved state, not free text to search by eye.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| student_id | text | NOT NULL | As typed, after `normalizeStudentId`. Always matches a real registration — `requestEmailCorrection` rejects the submission outright otherwise, before anything is written (see below) |
| full_name | text | NOT NULL | Self-reported, unverified — staff cross-checks it against `registration_id`'s row |
| requested_email | text | NOT NULL | Validated at submit (format + MX/mail-server check), never applied automatically |
| registration_id | uuid | FK → `registrations(id)` ON DELETE SET NULL, nullable | Matched on `student_id` alone at submit time. Stays nullable at the schema level for old rows from before this gate existed, and so voiding/deleting the matched registration later doesn't block touching this row — but a fresh submission with no match never reaches an insert at all (see below) |
| created_at | timestamptz | NOT NULL, default `now()` | |
| resolved_at / resolved_by | | nullable | Set together by "Mark resolved" on `/admin/email-fixes`, once staff has actually changed the address via the Dashboard's edit flow. This table never changes a registration's email itself — see the comment on `requestEmailCorrection` in `src/app/find/actions.ts` for why that has to stay a human decision |

**A student ID with no matching registration at all is rejected before it
reaches this table** (2026-09-22, after a real submission for a student who
had never registered showed up as pure noise with nothing staff could act
on). `requestEmailCorrection` checks `findRegistrationByStudentId` first,
before the MX check, the throttle, or any write — a bogus ID costs one
indexed read and nothing else. The throttle itself is keyed on **both**
`student_id` and `requested_email` (`countRecentEmailFixRequests` /
`countRecentEmailFixRequestsByEmail`), since a student-ID-only throttle
can't see someone cycling through several IDs while aiming at the same
destination inbox each time.

`/admin/email-fixes` is `requireAdmin()`-gated and outside staff's route
allowlist, matching `editRegistration` (the Dashboard action that actually
performs the fix) — a queue whose fix step staff can't reach would be
confusing to expose to them.

Every submission also writes an `email_correction_requested` row to
`activity_logs` (unchanged, generic system record), so this table and the
Activity log both show it — this one is the working queue, that one is the
permanent audit trail.

## walk_in_drafts

Added in `0016_walk_in_drafts.sql`. The half-typed "Type a list" sheet, one row
per staff member, so a paper sign-in sheet can be started on one phone and
finished on another. Exists because the list first lived only in that phone's
browser storage.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| user_id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE | One draft per person — two staff typing different sheets never overwrite each other |
| rows | jsonb | NOT NULL, default `[]` | Only `id, fullName, studentId, yearLevel, section, email` per row, at most 200, each value length-capped — see `sanitizeDraftRows()` in `src/lib/walk-in-drafts/sanitize.ts`. The client's JSON is never trusted |
| updated_at | timestamptz | NOT NULL, default `now()` | Set by the save action |

**RLS is on and there are no policies at all** — not even the usual
authenticated `SELECT`. Names, student IDs and emails are personal data, so
nothing reads this with the anon or authenticated key; the page and the save
action go through the service-role client (`src/lib/walk-in-drafts/queries.ts`).

An empty list deletes the row, so a finished sheet leaves nothing behind. It is
a working copy, not a record: nothing else reads it, and approving the rows is
what creates tickets. Last write wins between phones; the screen only saves
after a real edit, so opening it on a stale phone can't overwrite a newer list.

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
create policy "authenticated read expenses" on expenses
  for select to authenticated using (true);
create policy "authenticated read import_batches" on import_batches
  for select to authenticated using (true);
create policy "authenticated read receipts" on receipts
  for select to authenticated using (true);
```

`receipts` is read publicly at `/receipt/<id>` by an unauthenticated student,
and still gets no `anon` policy — the page reads through the service-role
client in a server component, the same way `evaluations` does.

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

`faculty_invitations` (`0017`) is the same case one step further out: the
writer is an anonymous visitor who scanned a shared QR, with no id in the URL
to identify them at all, and it still gets no policy for any role — not even
an authenticated `SELECT`. `submitAcknowledgement` re-validates everything
(the checkbox included) and writes through the service-role client.

## Storage

`receipts` bucket, **private**. Objects are keyed
`<year>/<uuid>.<ext>` (see `submitRegistration` in
`src/app/checkout/actions.ts`), never a guessable path. Admins read receipt
images only via `signedReceiptUrl()`, a 10-minute signed URL — there is no
public read path.

Expense receipt photos share this bucket under `expenses/<uuid>.<ext>`
(`uploadExpenseReceipt()` in `src/lib/expenses/queries.ts`) — a prefix
checkout's year-keyed paths can never produce. The photo is shrunk in the
browser first (longest side 2400px, JPEG), so a camera photo lands under
1 MB while small print stays legible when zoomed.

Walk-in bulk import files are kept here too, under `imports/<batch id>.xlsx`
(`startImportBatch()` in `src/lib/import-batches/queries.ts`), downloaded by
admins through `/admin/imports/file/[id]`.
