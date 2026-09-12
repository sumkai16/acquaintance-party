# Staging — test the scanner, raffle, etc. without touching real data

The app has one hosted Supabase project acting as the single source of
truth (see `context/ARCHITECTURE.md` §5 — no Docker, no local Supabase). A
git branch alone doesn't isolate data: any branch, run locally or deployed,
still reads and writes the same tables as production. This sets up a
second, throwaway Supabase project instead, wired only to Vercel Preview
deployments — production keeps using the real project untouched.

## 1. Create the staging Supabase project

Same as `docs/setup/supabase.md` §1 — new project, its own database
password. Region doesn't need to match production.

## 2. Apply every migration, in order

Follow `docs/setup/supabase.md` §6, pasting each file under
`supabase/migrations/` into the **staging** project's SQL Editor, in
filename order:
`0001_init.sql` → `0002_raffle.sql` → `0003_raffle_prizes_and_entrants.sql`
→ `0004_raffle_remove_prizes.sql` → `0005_student_id_and_walk_in.sql` →
`0006_evaluation.sql` → `0007_staff_roles_and_cash_remittance.sql` →
`0008_activity_log_fk_set_null.sql` → `0009_ticket_email.sql`.
The verification queries in that doc are optional here — worth running
once to confirm the constraints exist, but nothing to clean up carefully
afterward since this database is never going live.

## 3. Recreate the receipts bucket and lock down auth

`docs/setup/supabase.md` §3 (private `receipts` bucket) and §3 (email
provider on, signups off) — same steps, staging project.

## 4. Create test accounts

`docs/setup/supabase.md` §5, but name them obviously fake — e.g.
`test-admin@example.com` / `test-staff@example.com` — so nobody mistakes a
staging login for a real one, and give each a matching `profiles` row
(`admin` and `staff`) the same way.

## 5. Point Vercel Preview deployments at staging

In the Vercel project → **Settings → Environment Variables**, add
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` (and optionally the Discord/Sheets/Resend vars
if you want those exercised too) scoped to **Preview only**, using the
staging project's values. Production keeps its own copies scoped to
**Production** — the two never overlap.

This means every Preview deployment (any branch that isn't `master`) now
runs against staging, not just a `testing` branch — which is the safer
default, since no feature branch should be able to touch real
registrations either.

If you'd rather isolate just one branch instead of all previews, Vercel's
Custom Environments feature can bind a specific branch to its own variable
set — more moving parts than most testing needs, so only set that up if
Preview-wide staging turns out to be a problem.

## 6. Deploy and test

Push a branch — Vercel builds a Preview URL automatically. That URL is
HTTPS, so the scanner's camera works on a real phone, and two phones can
rehearse a real door with cross-device duplicate detection, all against
data that never touches production. Wipe and re-seed staging data anytime
via the SQL Editor; there's nothing there worth preserving.

Local `npm run dev` still reads whatever `.env.local` points to. Swap its
Supabase values to the staging project's when you want to test locally too
(`localhost` counts as a secure context, so the camera works there as
well) — just switch back before running anything against production.

## Status as of 2026-09-12 — done, and one open bug

Everything through step 5 above is complete:

- **Staging Supabase project**: `acquaintance-party-staging` (ref
  `eexwctdrgqvnauwdrrhl`), org **Acquaintance-Party-Staging**, region
  Southeast Asia (Singapore), Free plan.
- **Schema**: all 9 migrations applied and verified — `information_schema.tables`
  lists the same 8 tables production has (`registrations`, `scans`,
  `raffle_draws`, `raffle_extra_entrants`, `profiles`, `cash_remittances`,
  `activity_logs`, `evaluations`).
- **Storage**: private `receipts` bucket created.
- **Auth**: email provider on, self-signup off.
- **Test accounts**: `test-admin@example.com` (role `admin`) and
  `test-staff@example.com` (role `staff`), each with a matching `profiles`
  row. Passwords were set directly by the user, not recorded anywhere.
- **Vercel env vars** (`it2026` project): `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are now split into separate Production
  and Preview rows — Preview's point at the staging project above.
  `SUPABASE_SERVICE_ROLE_KEY` Preview row was edited to staging's key, but
  see the bug below — **it's very likely wrong**.
- **`testing` branch**: exists locally and on `origin`, currently at commit
  `a58fccb` ("chore: trigger a preview deploy against the staging Supabase
  project"). Its Preview URL is
  `https://it2026-git-testing-sumkai16s-projects.vercel.app` — stable,
  rebuilds on every push to `testing`, no need to look up a new URL each
  time.

### Open bug: admin login on the Preview URL fails with `?error=not_provisioned`

Signing in as `test-admin@example.com` on the Preview URL redirects to
`/admin/login?error=not_provisioned`, even though the matching `profiles`
row is confirmed present in the staging database (checked directly via
SQL — the row is there, the id matches `auth.users`).

**Root cause (strong suspicion, not yet fixed):** while pasting the
staging `service_role` key into Vercel's `SUPABASE_SERVICE_ROLE_KEY`
Preview value during browser automation, a `ctrl+a`-then-paste sequence
appears to have prepended a stray literal `a` character before the key
(`aeyJhbGci...` instead of `eyJhbGci...`). The exact same corruption was
directly caught and fixed on a different field that same session (a Key
field showed `aNEXT_PUBLIC_SUPABASE_ANON_KEY`), but it likely also
happened here, on the Value field, and wasn't caught before saving.

`adminClient()` (`src/lib/supabase/admin.ts`) uses
`SUPABASE_SERVICE_ROLE_KEY` to read `profiles` in `getProfile()`
(`src/lib/profiles/queries.ts`). A malformed key makes that Supabase call
fail; the code doesn't distinguish "call failed" from "no row found" —
both just return `null` — which the layout gate reports as "not
provisioned." This matches the symptom exactly.

**To fix, on whichever device continues this:**

1. Supabase dashboard → **acquaintance-party-staging** project → Settings
   → API Keys → **Legacy anon, service_role API keys** tab → Reveal, then
   Copy, the `service_role` key.
2. Vercel dashboard → project **it2026** → Settings → Environment
   Variables → find `SUPABASE_SERVICE_ROLE_KEY` scoped to **Preview** →
   Edit → replace the value with the freshly copied key.
   **Before clicking Save, check the value starts with `eyJ`, not
   `aeyJ`** — that one-character check is the whole bug.
3. Save, then force a fresh Preview build so the corrected key actually
   takes effect (env var edits alone don't touch an already-built
   deployment):
   ```
   git checkout testing
   git commit --allow-empty -m "chore: retry preview deploy with fixed service-role key"
   git push origin testing
   ```
4. Retry logging in at
   `https://it2026-git-testing-sumkai16s-projects.vercel.app/admin/login`
   as `test-admin@example.com`. `not_provisioned` should be gone.

### Then, to actually get scan/raffle test data

Staging's tables are empty — schema only, no rows. Once login works:

1. Log in as `test-admin@example.com` (or `test-staff@example.com`).
2. **Walk-in** → add a handful of fake students (any name/student ID/year/
   section, any cash amount). Each is approved immediately with a real
   `ticket_code` and QR — this exercises the real approval code path
   rather than hand-writing rows that might not match what
   `src/lib/tickets/code.ts` actually generates.
3. Open each new registration's ticket page for its QR.
4. **Scanner** → name the device → scan those QR codes. This writes
   `scans` rows with `result = 'ok'`.
5. **Raffle** now has an eligible pool (scanned-in students) to draw from.

### Other loose ends from today

- **Apex Track's production Supabase project is paused**, not deleted —
  this was needed to get under the account's 2-free-project cap before
  the staging project could be created. It has a second owner
  (`generalgenx60@gmail.com`) who wasn't consulted. Resume it from that
  project's Settings → General → Restart project (pauses are resumable
  for up to a year) once staging work is done, or sooner if it's
  needed for something else.
- The org **Aetheria** and one project under **sumkai16's Org** were
  deleted (not paused) by the user directly, also to clear the free-project
  cap. Not reversible.
- `master` and `testing` are both pushed to `origin`. `testing` is meant to
  stay a moving pointer for Preview deploys — no need to keep it in sync
  with `master` on any particular schedule, just rebase/merge it forward
  whenever a Preview build needs code that's landed on `master` since.
