# Supabase project setup

Manual dashboard steps — invisible in git, so recorded here for whoever
redoes this next year.

## 1. Create the project

1. https://supabase.com/dashboard → New project.
2. Region: **Southeast Asia (Singapore)**.
3. Set a database password and save it somewhere durable — shown once.

## 2. Copy the API keys into `.env.local`

**Project Settings → API Keys.** Copy from `.env.local.example` to
`.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` — the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon public` key (safe to ship to
  browsers; RLS protects it)
- `SUPABASE_SERVICE_ROLE_KEY` — the `service_role`/secret key. **Bypasses
  every RLS policy.** Never paste it into chat, a ticket, or a screenshot —
  rotate it (Roll/Revoke in the same panel) if it ever leaks.

## 3. Lock down auth

**Authentication → Sign In / Providers:**
- **Email provider: ON.** Without this, no one — including admins — can sign
  in with a password.
- **User Signups → "Allow new users to sign up": OFF.** Without this, anyone
  who finds `/admin/login` can register themselves as an admin.

These look contradictory but aren't: email login works, self-registration
doesn't. Admin accounts are created by hand instead — see step 5.

## 4. Create the private receipts bucket

**Storage → New bucket** → name exactly `receipts` → **Public: OFF** →
create. If it shows a "Public" badge, payment screenshots are readable by
anyone with the URL — fix this before any real submission.

## 5. Creating an admin account

**Authentication → Users → Add user** → email + password → tick **Auto
Confirm User**. Repeat for each admin/volunteer who needs to review receipts
or run the scanner.

## 6. Apply the schema

There is no Docker and no linked Supabase CLI on the dev machine, so
migrations are pasted by hand rather than run via `supabase db push`:

1. Open **SQL Editor** in the dashboard.
2. Paste the contents of `supabase/migrations/0001_init.sql`, run it.
3. Verify the core anti-fraud constraint is live — this should **fail**:
   ```sql
   insert into registrations (full_name, year_level, section, email,
     gcash_reference, receipt_path, amount, status, ticket_code)
   values ('Test Student', '3rd year', 'B', 't@example.com',
     '1234567890123', 'x.jpg', 35000, 'approved', null);
   ```
   Expected: `violates check constraint "ticket_code_matches_status"`. That
   error is correct — it proves an approved ticket can't exist without a
   scannable code.

4. Paste the contents of `supabase/migrations/0002_raffle.sql`, run it. This
   adds `raffle_draws` — the raffle page at `/admin/raffle` errors until it
   exists. Verify a draw with no shortlist can't be recorded — this should
   **fail**:
   ```sql
   insert into raffle_draws (prize_key, prize_name, winner_registration_id,
     finalists, pool_size, drawn_by)
   values ('grand', 'Grand prize', gen_random_uuid(), '[]'::jsonb, 1,
     gen_random_uuid());
   ```
   Expected: `violates check constraint "finalists_is_small_array"`. That
   error is correct — it proves a row that never came from a real draw can't
   be passed off as one.

5. Paste the contents of
   `supabase/migrations/0003_raffle_prizes_and_entrants.sql`, run it. This
   adds `raffle_prizes` (admin-managed, replaces the old config-file prize
   list) and `raffle_extra_entrants` (the manual/import supplement to the
   eligible pool), and drops the FK from `raffle_draws.winner_registration_id`
   to `registrations` — an extra entrant has no registration row, so a
   winner drawn from one couldn't satisfy it otherwise.

   **Before running the last statement in that file** (the `drop
   constraint`), confirm the actual constraint name rather than trusting the
   migration's comment:
   ```sql
   select conname from pg_constraint where conrelid = 'raffle_draws'::regclass;
   ```
   It should be `raffle_draws_winner_registration_id_fkey` — Postgres names
   an inline `references` this way by default. If it's different, edit the
   `drop constraint` line to match before running it.

   Once applied, `/admin/raffle` is ready to draw — the scanned-in pool is
   already the eligible list, no setup required before the first draw.

6. Paste the contents of `supabase/migrations/0004_raffle_remove_prizes.sql`,
   run it. Prizes turned out not to belong in the app at all — what's being
   raffled off is announced verbally at the podium, and the software's only
   job is picking a name — so this drops `raffle_prizes` outright and drops
   `prize_key`/`prize_name` from `raffle_draws`. Straightforward `DROP`
   statements, nothing to verify by hand.

7. Paste the contents of
   `supabase/migrations/0005_student_id_and_walk_in.sql`, run it. Adds a
   required `student_id` to every registration (QA feedback: nothing was
   stopping one student from submitting several times) and a
   `payment_method` column so a walk-in cash sale — no GCash reference, no
   receipt — can exist alongside an online one. Verify the anti-spam index
   is live — this should **fail** on the second insert:
   ```sql
   insert into registrations (full_name, student_id, year_level, section,
     email, payment_method, gcash_reference, receipt_path, amount, status,
     ticket_code)
   values ('Test A', 'sid-test-1', '3rd year', 'B', 'a@example.com',
     'online', '1111111111111', 'x.jpg', 49500, 'pending', null);

   insert into registrations (full_name, student_id, year_level, section,
     email, payment_method, gcash_reference, receipt_path, amount, status,
     ticket_code)
   values ('Test B', 'sid-test-1', '3rd year', 'B', 'b@example.com',
     'online', '2222222222222', 'y.jpg', 49500, 'pending', null);
   ```
   Expected: the second insert raises `duplicate key value violates unique
   constraint "registrations_student_id_active_key"`. That error is
   correct — it proves the same student ID can't have two active
   registrations at once. Clean up both test rows afterward:
   ```sql
   delete from registrations where student_id = 'sid-test-1';
   ```

Any future migration file added under `supabase/migrations/` gets applied
the same way: paste, run.

## 7. Discord notifications (optional)

Without this, an admin only finds out about a new registration by opening
`/admin/review` and looking — nobody should keep that tab open for two
weeks. This pings a Discord channel the instant someone submits.

1. In Discord: the target channel's settings → **Integrations → Webhooks →
   New Webhook** → copy the **Webhook URL**.
2. Paste it into `.env.local` as `DISCORD_WEBHOOK_URL`. Also add it to the
   Vercel project's environment variables before deploying — see the deploy
   checkpoint at the end of the plan.
3. Optionally set `NEXT_PUBLIC_SITE_URL` to the deployed site's URL (e.g.
   `https://your-app.vercel.app`, no trailing slash) so the Discord message
   includes a clickable link straight to the review queue.

Leaving `DISCORD_WEBHOOK_URL` unset is fine — checkout works normally, the
notification is just silently skipped, not an error.

## Before launch

Placeholder values that must be replaced before real money moves:

- [ ] Everything in `src/lib/config/event.ts` — name, date, venue, price,
      the GCash payee name and number
- [ ] `public/gcash-qr.png` — currently encodes a placeholder message, not a
      real payable QR
- [ ] Confirm the GCash account's wallet and monthly receiving limits can
      handle the expected sales volume before tickets go on sale
- [ ] `public/icon-192.png` and `public/icon-512.png` — solid black
      placeholders for the scanner's home-screen icon (plan 2), not an org
      logo
