# SCHEMA.md — Database Schema

Source of truth: `supabase/migrations/0001_init.sql`. This file is a fast
reference — if the two disagree, the migration file is right and this needs
updating.

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
offline scanners (plan 2) sync late, and reconciling what actually happened
at the door needs the full history, not a single flag that the last sync
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

Not yet written to by any code — `scans` exists in the schema ahead of the
scanner build (plan 2) so the table shape is settled before that work starts.

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
```

No `insert` policy exists for either table on any role — all inserts go
through the service-role client from server actions, which bypasses RLS
entirely. This is deliberate: see `context/RULES.md` §Security.

## Storage

`receipts` bucket, **private**. Objects are keyed
`<year>/<uuid>.<ext>` (see `submitRegistration` in
`src/app/checkout/actions.ts`), never a guessable path. Admins read receipt
images only via `signedReceiptUrl()`, a 10-minute signed URL — there is no
public read path.
