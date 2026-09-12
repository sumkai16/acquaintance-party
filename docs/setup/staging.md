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
