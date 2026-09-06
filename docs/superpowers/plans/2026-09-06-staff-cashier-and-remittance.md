# Staff Cashier & Cash Remittance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Staff account can sign in, record a walk-in cash ticket sale, see
their own running cash balance, and remit that cash to Admin for approval.
Admin can see every staff member's balance and every remittance, approve or
reject each one, and see the whole event's money in three numbers that never
double-count: total collected, cash currently with Admin, cash currently with
Staff.

**Not a new feature area — an extension of what exists.** Walk-in cash sales
already work (`/admin/walk-in` → `registrations` with `payment_method =
'walk_in'`, approved immediately, ticket + QR issued on the spot). This plan
adds a role (Staff vs. Admin) on top of the existing single-role admin auth,
and a custody layer (who is currently holding which cash, and the
remittance that transfers it to Admin) on top of the existing walk-in flow —
it does **not** introduce a second, parallel "payment record" concept. A
walk-in sale is still one row in `registrations`; nothing about ticket
issuance, the door scanner, or raffle eligibility changes.

**Spec:** the requirements doc reviewed in chat 2026-09-06 (Staff Account,
Walk-In Payment, Remittance, and Activity Log Requirements). Read
`context/SCHEMA.md`, `context/ARCHITECTURE.md`, and `context/RULES.md` before
touching any file below — this plan follows their conventions throughout
rather than introducing new ones.

**Plan is self-contained** — it doesn't depend on plans 1–3 being re-run, only on their result (the current `main` branch) being what's deployed.

## Design decisions worth not relitigating

These were judgment calls made while turning the requirements into a plan
that fits this codebase. Flagging them here, not just leaving them implicit
in the tasks, since they're the parts most likely worth a second opinion
before implementation starts.

1. **No `walk_in_payments` table.** The requirements doc's §15 schema
   proposes one, separate from `registrations`. That would mean a cash payer
   gets a "payment record" but no ticket — breaks the door scanner and
   raffle pool silently. A walk-in payment stays a `registrations` insert;
   this plan only adds custody tracking (who holds the cash, has it been
   remitted) on top of the row that already exists.
2. **No `users` table with a `password` column.** Supabase Auth already owns
   credentials (`auth.users`); this codebase never touches them directly.
   Roles live on a new `profiles` table (`id references auth.users`,
   `role`, `full_name`) — the idiomatic Supabase pattern, and the only new
   auth-adjacent table this plan adds.
3. **No `cash_balances` table.** Every balance (staff collected, pending
   remittance, admin current cash, staff cash on hand) is a `SUM()` over
   `registrations` and `cash_remittances` — the same "derive, don't cache"
   pattern the codebase already uses for attendance (`scans`, not a boolean
   flag) and total collected (`totalCollectedCentavos()`, not a running
   total). One consequence: approving a remittance is a single `UPDATE` on
   `cash_remittances`; every dependent number recalculates itself from that
   one row. No second write to keep in sync, so nothing to get out of sync.
4. **Staff keeps using `/admin/walk-in`, not a new form.** It already does
   exactly what's needed (student ID identity check, ticket issuance,
   confirmation email). The change is who's allowed to reach it and that it
   now writes an activity log entry — not a rewrite.
5. **Everything stays under `/admin/*`**, gated by role in
   `admin/layout.tsx`, rather than a separate `/staff` route tree. Staff
   gets a narrow allowlist of paths; Admin is unrestricted. This avoids
   duplicating the auth gate, the nav shell, and the login flow for a second
   route tree.
6. **No new "Admin Walk-in Payment Records" page.** §13 of the requirements
   asks for one, but it would be the same table as **Find a registration**
   with a payment-method filter and an "Added By" column — exactly the
   reasoning that already collapsed a dedicated Rejections page into Find a
   registration (`context/PRD.md`, 2026-09-04). This plan adds the filter
   and column to the existing page instead.
7. **"Transaction ID" and "Remittance ID" are the row's own UUID**, not a
   new human-readable sequence (`WP-001`, `REM-001`). Generating sequential
   codes needs a counter and a place for it to race; the existing
   `ticket_code` already plays this role for approved tickets. Displayed
   truncated (first 8 chars, uppercased) the way a git short-hash is — good
   enough to reference in conversation, not good enough to guess.
8. **Login/logout activity logging needs one small new plumbing piece.**
   Sign-in and sign-out currently happen entirely client-side
   (`browserClient().auth.signInWithPassword` / `.signOut()` in
   `admin-nav.tsx` and `login-form.tsx`) — nothing server-side ever
   observes them today. This plan adds a tiny server action on each path
   that writes the activity log entry before/after the client-side auth
   call.
9. **A staff member's "available to remit" is checked at submit time, not
   locked.** Two rapid double-clicks on Remit could both read the same
   available balance before either write lands, in principle over-remitting.
   For one or a handful of staff at a single school event, this is the same
   accepted-tradeoff shape as the scanner's offline double-admit case
   (`context/PRD.md` §8) — noted, not engineered around with row locks.
10. **Activity logs are written synchronously (`await`), not via `after()`.**
    The Google Sheets sync is best-effort by design because losing a row
    costs only convenience. An audit log entry for money is not that —
    if it fails, the admin should see the underlying action fail too rather
    than silently lose the audit trail. `logActivity()` still never *throws*
    into the caller (a logging bug must not block a real payment); it
    `console.error`s and returns, same error-handling shape as everything
    else in this codebase.

## Global Constraints

(All inherited from the existing three plans — restated because this plan
touches the same layers.)

- **Windows + PowerShell.** `&&` is not available — use `;` or separate
  commands.
- **No Docker, no local Supabase.** The new migration is pasted into the
  hosted project's SQL editor by hand — see Task 1, Step 2.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only, no exceptions.** Only
  `src/lib/supabase/admin.ts` reads it. Never import `adminClient` into a
  file under `"use client"`.
- **Anonymous users get zero RLS policies; authenticated gets broad `select`
  policies but no `insert`/`update`.** Every write goes through a server
  action using the service-role client. Staff-vs-admin and own-row-only
  scoping is enforced in `src/lib/*/queries.ts`, in application code — the
  same reasoning `context/RULES.md` already applies to the anon/authenticated
  split extends one level further here. **If you find yourself writing an
  RLS policy that references `profiles.role`, stop — that's the wrong
  layer**, and it also risks a recursive-policy trap (a `profiles` policy
  that queries `profiles` to decide who can read `profiles`).
- **Amount is stored in centavos as an `integer`.** Never a float. This
  applies to `cash_remittances.amount` exactly as it already does to
  `registrations.amount`.
- **All new user-facing dates/times use Asia/Manila**, not the server's
  default UTC — see Task 3. This is a real gap even in existing pages (no
  admin page currently passes `timeZone`), but it's only load-bearing for
  the first time here, where "submitted at 5:30 PM" needs to mean Manila
  5:30 PM to a Manila-based staff member checking it live.
- **Table UI reuses `src/app/admin/table.tsx`** (`Table`/`Th`/`Tr`, and
  `SortHeaderButton` for a client-side-filtered list) — every new table in
  this plan (remittances, activity logs) is built from it, not a bespoke
  `<table>`.

---

## File Structure

**Migration**
- `supabase/migrations/0007_staff_roles_and_cash_remittance.sql`

**Pure logic — no I/O, unit tested**
- `src/lib/activity/types.ts` — `ActivityType`, `describeActivity()`
- `src/lib/cash/balances.ts` — the handful of subtractions that turn raw
  sums into the numbers a dashboard card shows
- `src/lib/format/datetime.ts` — Asia/Manila date/time formatting

**Data access — server only**
- `src/lib/profiles/queries.ts`
- `src/lib/activity/queries.ts`
- `src/lib/cash/queries.ts`
- `src/lib/remittances/queries.ts`
- `src/lib/supabase/server.ts` — gains `currentProfile()`
- `src/lib/supabase/types.ts` — gains `UserRole`, `Profile`,
  `RemittanceStatus`, `CashRemittance`, `ActivityLog`

**Routes and components touched**
- `src/app/admin/layout.tsx` — modify: role-based path allowlist
- `src/app/admin/admin-nav.tsx` — modify: role-conditional nav links
- `src/app/admin/login/login-form.tsx` — modify: role-aware redirect
- `src/app/admin/session-actions.ts` — new: `logLogin()`, `logLogout()`
  (shared between the login form and the nav's sign-out button — the one
  deliberate exception to "actions.ts lives inside the route it serves,"
  since login/logout isn't owned by a single route)
- `src/app/admin/stat.tsx` — new: `Stat` card, extracted from
  `admin/dashboard/page.tsx` once a third page needs it
- `src/app/admin/walk-in/actions.ts` — modify: write an activity log entry
- `src/app/admin/review/actions.ts` — modify: write activity log entries
- `src/app/admin/registrations/actions.ts` — modify: write an activity log
  entry on Void
- `src/app/admin/registrations/page.tsx` + `registration-filters.tsx` —
  modify: payment-method filter, "Added By" column
- `src/app/admin/cashier/page.tsx` — new: Staff Dashboard
- `src/app/admin/cashier/remit-button.tsx` — new: client, confirm dialog
- `src/app/admin/cashier/actions.ts` — new: `submitRemittance()`
- `src/app/admin/cashier/activity/page.tsx` — new: Staff's own activity log
- `src/app/admin/cash/page.tsx` — new: Admin Cash Remittance Management
- `src/app/admin/cash/actions.ts` — new: `approveRemittance()`,
  `rejectRemittance()`
- `src/app/admin/activity/page.tsx` + `activity-filters.tsx` — new: system
  activity log with filters

---

## Task 1: Roles — `profiles`, route gating, login redirect

**Files:**
- Create: `supabase/migrations/0007_staff_roles_and_cash_remittance.sql`
  (full migration — profiles, cash_remittances, activity_logs all land in
  one hand-pasted step, same reasoning `0005` used to bundle two concerns
  that ship together)
- Create: `src/lib/profiles/queries.ts`
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/admin-nav.tsx`
- Modify: `src/app/admin/login/login-form.tsx`
- Modify: `docs/setup/supabase.md`

**Interfaces:**
- Produces: `type UserRole = "admin" | "staff"`, `type Profile = { id: string; fullName: string; role: UserRole }`, `getProfile(id: string): Promise<Profile | null>`, `listStaffProfiles(): Promise<Profile[]>`, `currentProfile(): Promise<Profile | null>`

- [ ] **Step 1: Write the full migration**

Create `supabase/migrations/0007_staff_roles_and_cash_remittance.sql`:

```sql
-- Staff accounts, cash remittance, and the system activity log.
--
-- Access model unchanged from every prior migration: authenticated gets
-- broad SELECT (defense in depth), but there is no INSERT/UPDATE policy on
-- any of these tables for any role. Every write goes through a server
-- action using the service-role client, which enforces staff-vs-admin and
-- own-row-only scoping in application code — see context/RULES.md and this
-- plan's Global Constraints for why that's deliberate, not an oversight.

create type user_role as enum ('admin', 'staff');
create type remittance_status as enum ('pending', 'approved', 'rejected');

-- One row per Supabase Auth user. Accounts are still created by hand in the
-- dashboard (no signup) — see docs/setup/supabase.md, updated in this task
-- to add the matching profile-row step.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  role       user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- A staff member's request to hand their collected cash to Admin. Approving
-- one is the only event that moves money from "staff cash on hand" to
-- "admin current collection" — see cash_remittances_staff_idx and the
-- approval_fields_match_status constraint below for the two invariants that
-- protect that transfer.
create table cash_remittances (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid not null references auth.users (id),
  amount           integer not null check (amount > 0),
  status           remittance_status not null default 'pending',
  submitted_at     timestamptz not null default now(),
  approved_at      timestamptz,
  approved_by      uuid references auth.users (id),
  rejection_reason text,

  -- A rejection must say why, same reasoning as registrations.reject_reason.
  constraint remittance_rejection_has_reason check (
    status <> 'rejected' or length(trim(coalesce(rejection_reason, ''))) > 0
  ),
  -- An approved remittance must carry who approved it and when; anything
  -- else must not. Backstops approveRemittance() the same way
  -- ticket_code_matches_status backstops approveRegistration().
  constraint approval_fields_match_status check (
    (status = 'approved' and approved_at is not null and approved_by is not null)
    or (status <> 'approved' and approved_at is null and approved_by is null)
  )
);

create index cash_remittances_staff_idx on cash_remittances (staff_id, status);
create index cash_remittances_status_idx on cash_remittances (status, submitted_at desc);

-- Append-only, immutable from the app. Every login/logout, walk-in sale,
-- payment approval/rejection, void, and remittance action writes one row
-- here. No UPDATE or DELETE policy exists for any role, on purpose — see
-- requirement §14, "immutable from the normal UI."
create table activity_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id),
  activity_type   text not null,
  description     text not null,
  registration_id uuid references registrations (id),
  remittance_id   uuid references cash_remittances (id),
  amount          integer,
  created_at      timestamptz not null default now()
);

create index activity_logs_user_idx on activity_logs (user_id, created_at desc);
create index activity_logs_type_idx on activity_logs (activity_type, created_at desc);
create index activity_logs_registration_idx on activity_logs (registration_id);

alter table profiles enable row level security;
alter table cash_remittances enable row level security;
alter table activity_logs enable row level security;

create policy "authenticated read profiles" on profiles
  for select to authenticated using (true);
create policy "authenticated read cash_remittances" on cash_remittances
  for select to authenticated using (true);
create policy "authenticated read activity_logs" on activity_logs
  for select to authenticated using (true);
```

- [ ] **Step 2: Apply the migration by hand**

Same process as every prior migration (`docs/setup/supabase.md` §6): open
the hosted project's SQL editor, paste the file, run it.

Verify the two check constraints actually bite:

```sql
insert into cash_remittances (staff_id, amount, status)
values ('00000000-0000-0000-0000-000000000000', 100000, 'rejected');
-- Expected: ERROR — violates check constraint "remittance_rejection_has_reason"

insert into cash_remittances (staff_id, amount, status, approved_by)
values ('00000000-0000-0000-0000-000000000000', 100000, 'approved',
        '00000000-0000-0000-0000-000000000000');
-- Expected: ERROR — violates check constraint "approval_fields_match_status"
--           (approved_at is missing)
```

Delete no rows — both inserts should have failed, so there's nothing to clean up.

- [ ] **Step 3: Backfill profiles for every existing admin, and update the runbook**

Every account created before this migration has no `profiles` row. In the
SQL editor, for each existing admin (there's no way to script this — cross-
reference `auth.users` emails by hand):

```sql
insert into profiles (id, full_name, role)
values ('<auth.users.id>', '<Full Name>', 'admin');
```

Update `docs/setup/supabase.md` §5 ("Creating an admin account") to a new
§5 ("Creating an admin or staff account") documenting both steps together:
create the `auth.users` row as before, **then** insert the matching
`profiles` row with the intended `role`. Note explicitly: an `auth.users`
row with no matching `profiles` row can sign in but hits every route's
staff-allowlist check and goes nowhere — `currentProfile()` returning `null`
should be treated as "not provisioned yet," not "admin by default." (This is
the opposite default of today's system, where any signed-in user is an
admin — call that out as the behavior change it is.)

- [ ] **Step 4: Add the row types**

In `src/lib/supabase/types.ts`, add:

```ts
export type UserRole = "admin" | "staff";
export type RemittanceStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  fullName: string;
  role: UserRole;
};

export type CashRemittance = {
  id: string;
  staff_id: string;
  amount: number;
  status: RemittanceStatus;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
};
```

- [ ] **Step 5: Write the profile queries**

Create `src/lib/profiles/queries.ts`:

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await adminClient()
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, fullName: data.full_name, role: data.role };
}

/** For Admin's "Staff Account" filter dropdown on the activity log and cash pages. */
export async function listStaffProfiles(): Promise<Profile[]> {
  const { data } = await adminClient()
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "staff")
    .order("full_name");

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
  }));
}
```

- [ ] **Step 6: Add `currentProfile()`**

In `src/lib/supabase/server.ts`, alongside the existing `currentAdminId()`
(unchanged — still used anywhere the caller only needs "is someone signed
in," e.g. the walk-in action, which both roles may call):

```ts
import { getProfile } from "@/lib/profiles/queries";
import type { Profile } from "@/lib/supabase/types";

/** The signed-in user's role and name, or null if not signed in or not provisioned. */
export async function currentProfile(): Promise<Profile | null> {
  const id = await currentAdminId();
  if (!id) return null;
  return getProfile(id);
}
```

- [ ] **Step 7: Gate `/admin/*` by role**

Modify `src/app/admin/layout.tsx`. Staff gets an explicit allowlist of path
prefixes; everything else redirects to their dashboard. Admin is
unrestricted, same as today.

```tsx
import { currentProfile } from "@/lib/supabase/server";

const STAFF_ALLOWED_PREFIXES = ["/admin/cashier", "/admin/walk-in"];

// ...inside AdminLayout, after the existing "not signed in -> /admin/login" check:
if (!isLogin) {
  const profile = await currentProfile();
  if (!profile) redirect("/admin/login"); // signed in, but no profile row yet

  if (
    profile.role === "staff" &&
    !STAFF_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    redirect("/admin/cashier");
  }
}
```

Note: this replaces the existing `auth.getUser()` call with `currentProfile()`
(which calls it internally) — don't call both.

- [ ] **Step 8: Role-conditional nav**

Modify `src/app/admin/admin-nav.tsx`. Split `LINKS` by role and fetch the
current profile once at the top of the component (it's already a client
component reading `usePathname`/`useRouter`; fetching role client-side means
one more read — simplest is to pass `role` down as a prop from
`admin/layout.tsx`, which already has it, rather than re-fetching in a
client component):

```tsx
const ADMIN_LINKS = [
  { href: "/admin/review", label: "Payments" },
  { href: "/admin/walk-in", label: "Walk-in" },
  { href: "/admin/scan", label: "Scanner" },
  { href: "/admin/dashboard", label: "Attendance" },
  { href: "/admin/cash", label: "Cash" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/raffle", label: "Raffle" },
  { href: "/admin/evaluations", label: "Evaluation" },
  { href: "/admin/registrations", label: "Find a registration" },
] as const;

const STAFF_LINKS = [
  { href: "/admin/cashier", label: "My Dashboard" },
  { href: "/admin/walk-in", label: "Walk-in" },
  { href: "/admin/cashier/activity", label: "My Activity" },
] as const;

export function AdminNav({ role }: { role: "admin" | "staff" }) {
  const LINKS = role === "admin" ? ADMIN_LINKS : STAFF_LINKS;
  // ...rest unchanged, mapping over LINKS as before
}
```

Update `admin/layout.tsx` to pass `role={profile.role}` into `<AdminNav />`.

- [ ] **Step 9: Role-aware login redirect**

Modify `src/app/admin/login/login-form.tsx`. After a successful
`signInWithPassword`, the session cookie is set client-side, so a direct
`profiles` read via `browserClient()` works under the new "authenticated
read profiles" policy:

```tsx
const { data: authData, error } = await browserClient().auth.signInWithPassword({...});
if (error) { /* unchanged */ }

const { data: profile } = await browserClient()
  .from("profiles")
  .select("role")
  .eq("id", authData.user.id)
  .maybeSingle();

router.push(profile?.role === "staff" ? "/admin/cashier" : "/admin/review");
router.refresh();
```

If `profile` is `null` (no row yet — see Step 3's note), fall back to
`/admin/review`; `admin/layout.tsx`'s Step 7 gate will redirect a staff-role
user correctly regardless, so this fallback only matters for an
unprovisioned account, which the layout will bounce to login-with-no-profile
handling anyway.

- [ ] **Step 10: Build and verify by hand**

```powershell
npm run build
npm run dev
```

1. Sign in as an existing (now backfilled `role='admin'`) account → lands on
   `/admin/review`, full nav visible, every route reachable.
2. Create one throwaway `auth.users` + `profiles(role='staff')` account by
   hand. Sign in as it → lands on `/admin/cashier` (404 for now — Task 8
   builds it; confirm the redirect happens, not the destination page).
3. As the staff account, try navigating directly to `/admin/review` →
   bounced to `/admin/cashier`.
4. As the staff account, navigate to `/admin/walk-in` → reachable.

- [ ] **Step 11: Commit**

```powershell
git add -A
git commit -m "feat: add staff role, profiles table, and role-gated admin routes"
```

---

## Task 2: Activity log — types, pure formatter, read/write queries

**Files:**
- Create: `src/lib/activity/types.ts`
- Test: `src/lib/activity/types.test.ts`
- Create: `src/lib/activity/queries.ts`
- Modify: `src/lib/supabase/types.ts`

**Interfaces:**
- Consumes: nothing (pure module); `adminClient` (queries module)
- Produces: `ACTIVITY_TYPES`, `type ActivityType`, `describeActivity(type: ActivityType): string`, `logActivity(entry): Promise<void>`, `listOwnActivity(userId, limit?): Promise<ActivityLog[]>`, `listActivity(filters): Promise<ActivityLog[]>`

- [ ] **Step 1: Write the failing test for the pure formatter**

Create `src/lib/activity/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES, describeActivity } from "./types";

describe("describeActivity", () => {
  it("has a human label for every declared activity type", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(describeActivity(type).length).toBeGreaterThan(0);
    }
  });

  it("labels a walk-in payment the way staff and admin both see it", () => {
    expect(describeActivity("walk_in_payment_added")).toBe("Walk-in Payment Added");
  });

  it("labels login and logout distinctly", () => {
    expect(describeActivity("login")).toBe("Login");
    expect(describeActivity("logout")).toBe("Logout");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

```powershell
npm test -- src/lib/activity/types.test.ts
```

Expected: FAIL — `Failed to resolve import "./types"`.

- [ ] **Step 3: Implement**

Create `src/lib/activity/types.ts`:

```ts
/**
 * Every kind of event the system writes to activity_logs. Adding a new kind
 * of loggable action means adding it here first — logActivity() takes only
 * these, so a typo can't silently create an unfiltered, unlabeled row.
 */
export const ACTIVITY_TYPES = [
  "login",
  "logout",
  "walk_in_payment_added",
  "payment_approved",
  "payment_rejected",
  "registration_voided",
  "remittance_submitted",
  "remittance_approved",
  "remittance_rejected",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const LABELS: Record<ActivityType, string> = {
  login: "Login",
  logout: "Logout",
  walk_in_payment_added: "Walk-in Payment Added",
  payment_approved: "Payment Approved",
  payment_rejected: "Payment Rejected",
  registration_voided: "Registration Voided",
  remittance_submitted: "Remittance Submitted",
  remittance_approved: "Remittance Approved",
  remittance_rejected: "Remittance Rejected",
};

export function describeActivity(type: ActivityType): string {
  return LABELS[type];
}
```

- [ ] **Step 4: Run and confirm it passes**

```powershell
npm test -- src/lib/activity/types.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Add the row type**

In `src/lib/supabase/types.ts`, add:

```ts
import type { ActivityType } from "@/lib/activity/types";

export type ActivityLog = {
  id: string;
  user_id: string | null;
  activity_type: ActivityType;
  description: string;
  registration_id: string | null;
  remittance_id: string | null;
  amount: number | null;
  created_at: string;
};
```

- [ ] **Step 6: Write the read/write queries**

Create `src/lib/activity/queries.ts`:

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { ActivityLog, RegistrationStatus } from "@/lib/supabase/types";
import type { ActivityType } from "./types";

type LogEntry = {
  userId: string | null;
  activityType: ActivityType;
  description: string;
  registrationId?: string;
  remittanceId?: string;
  amount?: number;
};

/**
 * Writes one immutable audit row. Never throws — a logging failure must not
 * fail the payment/remittance/login it's describing, so this swallows its
 * own error after reporting it. Called with `await`, not `after()`: unlike
 * the Sheets sync, losing an audit row is not an accepted cost (see this
 * plan's Design decisions, #10).
 */
export async function logActivity(entry: LogEntry): Promise<void> {
  const { error } = await adminClient().from("activity_logs").insert({
    user_id: entry.userId,
    activity_type: entry.activityType,
    description: entry.description,
    registration_id: entry.registrationId ?? null,
    remittance_id: entry.remittanceId ?? null,
    amount: entry.amount ?? null,
  });

  if (error) console.error("logActivity failed", entry.activityType, error);
}

export async function listOwnActivity(
  userId: string,
  limit = 200,
): Promise<ActivityLog[]> {
  const { data } = await adminClient()
    .from("activity_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as ActivityLog[]) ?? [];
}

export type ActivityFilters = {
  userId?: string;
  activityType?: ActivityType;
  fromIso?: string;
  toIso?: string;
  query?: string; // matches description, or a registration's student name/id via a join — see Step 7 note
};

export async function listActivity(filters: ActivityFilters, limit = 200): Promise<ActivityLog[]> {
  let builder = adminClient().from("activity_logs").select("*");

  if (filters.userId) builder = builder.eq("user_id", filters.userId);
  if (filters.activityType) builder = builder.eq("activity_type", filters.activityType);
  if (filters.fromIso) builder = builder.gte("created_at", filters.fromIso);
  if (filters.toIso) builder = builder.lt("created_at", filters.toIso);
  if (filters.query) {
    const safe = filters.query.trim().replace(/[%_,()\\]/g, "");
    if (safe.length >= 2) builder = builder.ilike("description", `%${safe}%`);
  }

  const { data } = await builder.order("created_at", { ascending: false }).limit(limit);
  return (data as ActivityLog[]) ?? [];
}
```

Note for Task 12: the requirement's "search by Transaction ID / Student
Name / Student ID / Payment Reference" needs matching against fields that
live on `registrations`, not `activity_logs`. Simplest correct approach:
`description` already embeds the student's name at write time (Task 5's
call sites build a description like `"Walk-in payment for Juan Dela Cruz
(2024-00123)"`), so a plain `ilike` on `description` covers name and student
ID search without a join. Transaction ID search (`registration_id`) is a
separate exact-match branch — add `if (filters.registrationId) builder =
builder.eq("registration_id", filters.registrationId)` when Task 12 wires
up that filter.

- [ ] **Step 7: Build and commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: add activity log schema, formatter, and queries"
```

---

## Task 3: Philippine time formatting

**Files:**
- Create: `src/lib/format/datetime.ts`
- Test: `src/lib/format/datetime.test.ts`

**Interfaces:**
- Produces: `formatDatePH(iso: string): string`, `formatTimePH(iso: string): string`, `formatDateTimePH(iso: string): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format/datetime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDatePH, formatDateTimePH, formatTimePH } from "./datetime";

// 2026-09-06T09:42:00Z is 2026-09-06 17:42 in Asia/Manila (UTC+8) — chosen
// deliberately so a bug that forgets the timeZone option (defaulting to the
// server's UTC) produces a visibly different hour, not a coincidentally
// matching one.
const UTC_MORNING = "2026-09-06T09:42:00.000Z";

describe("formatDatePH", () => {
  it("renders the Manila calendar date, not the UTC one", () => {
    expect(formatDatePH(UTC_MORNING)).toBe("Sep 6, 2026");
  });
});

describe("formatTimePH", () => {
  it("renders the Manila wall-clock time", () => {
    expect(formatTimePH(UTC_MORNING)).toBe("5:42 PM");
  });
});

describe("formatDateTimePH", () => {
  it("combines both", () => {
    expect(formatDateTimePH(UTC_MORNING)).toBe("Sep 6, 2026, 5:42 PM");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

```powershell
npm test -- src/lib/format/datetime.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/format/datetime.ts`:

```ts
const TIME_ZONE = "Asia/Manila";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDatePH(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatTimePH(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTimePH(iso: string): string {
  return `${formatDatePH(iso)}, ${formatTimePH(iso)}`;
}

/** Start of "today" in Manila, as a UTC ISO instant — for date-range filters. */
export function startOfTodayPH(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  // Manila is a fixed UTC+8 offset (no DST) — safe to hardcode.
  return `${y}-${m}-${d}T00:00:00+08:00`;
}
```

- [ ] **Step 4: Run and confirm it passes**

```powershell
npm test -- src/lib/format/datetime.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: format dates and times in Asia/Manila"
```

---

## Task 4: Log login and logout

**Files:**
- Create: `src/app/admin/session-actions.ts`
- Modify: `src/app/admin/login/login-form.tsx`
- Modify: `src/app/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `logActivity`, `currentProfile`
- Produces: `logLogin(): Promise<void>`, `logLogout(): Promise<void>`

- [ ] **Step 1: Write the session actions**

Create `src/app/admin/session-actions.ts`:

```ts
"use server";

import { currentProfile } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";

export async function logLogin(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) return;
  await logActivity({
    userId: profile.id,
    activityType: "login",
    description: `${profile.fullName} logged in`,
  });
}

/** Must be called BEFORE the client-side auth.signOut() — see admin-nav.tsx. */
export async function logLogout(): Promise<void> {
  const profile = await currentProfile();
  if (!profile) return;
  await logActivity({
    userId: profile.id,
    activityType: "logout",
    description: `${profile.fullName} logged out`,
  });
}
```

- [ ] **Step 2: Call `logLogin` after sign-in**

In `login-form.tsx`, right after the successful `signInWithPassword` call
and before the profile-role read added in Task 1 Step 9:

```tsx
import { logLogin } from "../session-actions";
// ...
await logLogin();
```

- [ ] **Step 3: Call `logLogout` before sign-out**

In `admin-nav.tsx`'s `signOut()`:

```tsx
import { logLogout } from "./session-actions";

async function signOut() {
  await logLogout(); // while the session cookie is still valid
  await browserClient().auth.signOut();
  router.push("/admin/login");
  router.refresh();
}
```

- [ ] **Step 4: Verify by hand**

```powershell
npm run dev
```

Sign in, sign out, sign in again. After each, check
`select activity_type, description, created_at from activity_logs order by
created_at desc limit 5;` in the Supabase SQL editor — two rows per
sign-in/out cycle, correctly ordered.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: log login and logout activity"
```

---

## Task 5: Wire activity logging into existing actions

**Files:**
- Modify: `src/app/admin/walk-in/actions.ts`
- Modify: `src/app/admin/review/actions.ts`
- Modify: `src/app/admin/registrations/actions.ts`

**Interfaces:**
- Consumes: `logActivity`, `currentProfile`

- [ ] **Step 1: Log a walk-in sale**

In `src/app/admin/walk-in/actions.ts`, after `createWalkInRegistration`
succeeds (right before the `after(() => sendTicketApprovedEmail(...))`
call), add:

```ts
const profile = await currentProfile(); // adminId is already known to be valid at this point
await logActivity({
  userId: adminId,
  activityType: "walk_in_payment_added",
  description: `${profile?.fullName ?? "Someone"} recorded a walk-in payment for ${parsed.data.fullName} (${parsed.data.studentId})`,
  registrationId: created.id,
  amount: EVENT.ticketPriceCentavos,
});
```

- [ ] **Step 2: Log payment approval and rejection**

In `src/app/admin/review/actions.ts`, find `approveRegistration` and
`rejectRegistration` (or their equivalents — confirm exact names by reading
the file first). After each succeeds, log with the registration's
`full_name`/`student_id`/`amount` and the acting admin's id, using
`activityType: "payment_approved"` / `"payment_rejected"`.

- [ ] **Step 3: Log a void**

In `src/app/admin/registrations/actions.ts`, find `voidRegistration`. After
it succeeds, log `activityType: "registration_voided"` with the reason and
the affected registration's id.

- [ ] **Step 4: Verify by hand**

Approve one pending registration, reject another, void an approved one.
Confirm three new `activity_logs` rows, each with the correct
`registration_id` and a description naming the student.

- [ ] **Step 5: Build, test, and commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: log payment approval, rejection, and void activity"
```

---

## Task 6: Cash balance math — pure functions and derived queries

**Files:**
- Create: `src/lib/cash/balances.ts`
- Test: `src/lib/cash/balances.test.ts`
- Create: `src/lib/cash/queries.ts`

**Interfaces:**
- Produces (pure): `currentCollectionCentavos(collected: number, approvedRemitted: number): number`, `availableToRemitCentavos(currentCollection: number, pendingRemitted: number): number`
- Produces (server-only): `type StaffCashSummary`, `staffCashSummary(staffId: string): Promise<StaffCashSummary>`, `adminCurrentCollectionCentavos(): Promise<number>`, `staffCashOnHandCentavos(): Promise<number>`, `pendingRemittancesCentavos(): Promise<number>`

This is the task worth the most care — every dashboard card and every
business rule in §16 of the requirements traces back to these few numbers.

- [ ] **Step 1: Write the failing tests for the pure math**

Create `src/lib/cash/balances.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { availableToRemitCentavos, currentCollectionCentavos } from "./balances";

describe("currentCollectionCentavos", () => {
  it("does not drop while a remittance is only pending — matches the spec's example", () => {
    // Staff has collected 3000, submitted (but not yet approved) a 3000 remittance.
    expect(currentCollectionCentavos(300000, 0)).toBe(300000);
  });

  it("drops by exactly the approved amount once a remittance is approved", () => {
    expect(currentCollectionCentavos(300000, 300000)).toBe(0);
  });

  it("never goes negative even if inputs are inconsistent", () => {
    expect(currentCollectionCentavos(100000, 300000)).toBe(0);
  });
});

describe("availableToRemitCentavos", () => {
  it("equals current collection when nothing is pending", () => {
    expect(availableToRemitCentavos(300000, 0)).toBe(300000);
  });

  it("is zero while the full collected amount is already pending — blocks a second remittance", () => {
    expect(availableToRemitCentavos(300000, 300000)).toBe(0);
  });

  it("never goes negative", () => {
    expect(availableToRemitCentavos(100000, 300000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

```powershell
npm test -- src/lib/cash/balances.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/cash/balances.ts`:

```ts
/**
 * "Total Collected" on the staff dashboard — stays at the full collected
 * amount while a remittance covering it is only pending, and drops only
 * once Admin actually approves it. This is the spec's explicit example
 * (requirements §7): pending must not silently zero the card before Admin
 * has acted.
 */
export function currentCollectionCentavos(
  collectedCentavos: number,
  approvedRemittedCentavos: number,
): number {
  return Math.max(0, collectedCentavos - approvedRemittedCentavos);
}

/**
 * What a staff member is actually allowed to remit right now — unlike
 * currentCollectionCentavos, this DOES subtract what's already pending, so
 * the same cash can't be submitted in two remittances at once (requirements
 * §16 rule 3). The "Total Collected" card and the Remit button's limit are
 * deliberately different numbers for this reason.
 */
export function availableToRemitCentavos(
  currentCollectionCentavos: number,
  pendingRemittedCentavos: number,
): number {
  return Math.max(0, currentCollectionCentavos - pendingRemittedCentavos);
}
```

- [ ] **Step 4: Run and confirm they pass**

```powershell
npm test -- src/lib/cash/balances.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the server-only aggregate queries**

Create `src/lib/cash/queries.ts`. Reuses `totalCollectedCentavos()` and
`approvedCount()` from `src/lib/scans/queries.ts` (already sum every
approved registration, online and walk-in alike — exactly "Total Event
Collection" / "Total Payments") rather than re-deriving them.

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { availableToRemitCentavos, currentCollectionCentavos } from "./balances";
import { startOfTodayPH } from "@/lib/format/datetime";

/**
 * Sum of a staff member's own walk-in sales. Filtered to status='approved'
 * deliberately: if an admin later Voids one of this staff's walk-in tickets
 * (registrations.status -> 'rejected'), that cash should no longer count as
 * theirs to remit — Void already exists as a feature; this just makes cash
 * accounting agree with it instead of silently drifting.
 */
async function staffWalkInCollectedCentavos(staffId: string): Promise<number> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("payment_method", "walk_in")
    .eq("reviewed_by", staffId)
    .eq("status", "approved");
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}

async function staffRemittedCentavos(
  staffId: string,
  status: "pending" | "approved",
): Promise<number> {
  const { data } = await adminClient()
    .from("cash_remittances")
    .select("amount")
    .eq("staff_id", staffId)
    .eq("status", status);
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}

export type StaffCashSummary = {
  collectedCentavos: number;
  currentCollectionCentavos: number;
  pendingRemittanceCentavos: number;
  availableToRemitCentavos: number;
  todayCollectionCentavos: number;
  transactionCount: number;
};

export async function staffCashSummary(staffId: string): Promise<StaffCashSummary> {
  const [collected, approvedRemitted, pendingRemitted, todayRows, countResult] =
    await Promise.all([
      staffWalkInCollectedCentavos(staffId),
      staffRemittedCentavos(staffId, "approved"),
      staffRemittedCentavos(staffId, "pending"),
      adminClient()
        .from("registrations")
        .select("amount")
        .eq("payment_method", "walk_in")
        .eq("reviewed_by", staffId)
        .eq("status", "approved")
        .gte("created_at", startOfTodayPH()),
      adminClient()
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("payment_method", "walk_in")
        .eq("reviewed_by", staffId)
        .eq("status", "approved"),
    ]);

  const current = currentCollectionCentavos(collected, approvedRemitted);
  return {
    collectedCentavos: collected,
    currentCollectionCentavos: current,
    pendingRemittanceCentavos: pendingRemitted,
    availableToRemitCentavos: availableToRemitCentavos(current, pendingRemitted),
    todayCollectionCentavos: (todayRows.data ?? []).reduce(
      (sum, row) => sum + (row.amount as number),
      0,
    ),
    transactionCount: countResult.count ?? 0,
  };
}

/** Admin's own direct walk-in sales, plus every approved remittance received from staff. */
export async function adminCurrentCollectionCentavos(): Promise<number> {
  const [{ data: admins }, { data: remittances }] = await Promise.all([
    adminClient().from("profiles").select("id").eq("role", "admin"),
    adminClient().from("cash_remittances").select("amount").eq("status", "approved"),
  ]);

  const adminIds = (admins ?? []).map((row) => row.id);
  let ownSales = 0;
  if (adminIds.length > 0) {
    const { data } = await adminClient()
      .from("registrations")
      .select("amount")
      .eq("payment_method", "walk_in")
      .eq("status", "approved")
      .in("reviewed_by", adminIds);
    ownSales = (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  }

  const remitted = (remittances ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  return ownSales + remitted;
}

/** Sum, across every staff member, of cash collected but not yet approved-remitted. */
export async function staffCashOnHandCentavos(): Promise<number> {
  const { data: staff } = await adminClient().from("profiles").select("id").eq("role", "staff");
  const staffIds = (staff ?? []).map((row) => row.id);
  if (staffIds.length === 0) return 0;

  const [{ data: sales }, { data: remittances }] = await Promise.all([
    adminClient()
      .from("registrations")
      .select("amount")
      .eq("payment_method", "walk_in")
      .eq("status", "approved")
      .in("reviewed_by", staffIds),
    adminClient().from("cash_remittances").select("amount").eq("status", "approved"),
  ]);

  const collected = (sales ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  const remitted = (remittances ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  return currentCollectionCentavos(collected, remitted);
}

export async function pendingRemittancesCentavos(): Promise<number> {
  const { data } = await adminClient().from("cash_remittances").select("amount").eq("status", "pending");
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}
```

- [ ] **Step 6: Verify the invariant by hand against real data**

After Task 10 makes remittances approvable, this is the check to run before
calling the feature done — but sanity-check the arithmetic now with a
throwaway script or the SQL editor:

```
totalEventCollection = totalCollectedCentavos()               // scans/queries.ts, unchanged
adminCurrent         = adminCurrentCollectionCentavos()
staffOnHand          = staffCashOnHandCentavos()
pendingRemit         = pendingRemittancesCentavos()

assert adminCurrent + staffOnHand == totalEventCollection
```

This is requirement §8's worked example, restated as an equation. If it
ever doesn't hold, the bug is in one of these functions, not in the UI
that displays them.

- [ ] **Step 7: Build, test, commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: derive staff and admin cash balances from transactions"
```

---

## Task 7: Extract the shared `Stat` card

**Files:**
- Create: `src/app/admin/stat.tsx`
- Modify: `src/app/admin/dashboard/page.tsx`

**Interfaces:**
- Produces: `Stat({ label, value }: { label: string; value: number | string }): JSX.Element`

- [ ] **Step 1: Move `Stat` out of `dashboard/page.tsx`**

It's about to be used on three pages (`admin/dashboard`, `admin/cashier`,
`admin/cash`) — past this codebase's own "extract when it repeats, not
before" threshold. Cut the existing `Stat` function out of
`src/app/admin/dashboard/page.tsx` verbatim and paste it into a new
`src/app/admin/stat.tsx`, exported. Import it back into `dashboard/page.tsx`.

```tsx
// src/app/admin/stat.tsx
export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <dt className="text-sm text-ground/60">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums text-ground">{value}</dd>
    </div>
  );
}
```

(Copy the exact existing markup/classes from `dashboard/page.tsx` rather
than retyping — this step should produce a zero-visual-diff refactor.)

- [ ] **Step 2: Verify no visual change**

```powershell
npm run dev
```

`/admin/dashboard` renders pixel-identical to before.

- [ ] **Step 3: Build and commit**

```powershell
npm run build
git add -A
git commit -m "refactor: extract shared Stat card component"
```

---

## Task 8: Staff Dashboard

**Files:**
- Create: `src/app/admin/cashier/page.tsx`

**Interfaces:**
- Consumes: `currentProfile`, `staffCashSummary`, `Stat`, `formatPeso`

- [ ] **Step 1: Build the page**

Create `src/app/admin/cashier/page.tsx` (Server Component):

```tsx
import { redirect } from "next/navigation";
import { formatPeso } from "@/lib/config/event";
import { currentProfile } from "@/lib/supabase/server";
import { staffCashSummary } from "@/lib/cash/queries";
import { Stat } from "../stat";
import { RemitButton } from "./remit-button";

export const metadata = { title: "My Dashboard" };

export default async function CashierDashboardPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/admin/login");

  const summary = await staffCashSummary(profile.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Hi, {profile.fullName}</h1>
      <p className="mt-1 text-ground/70">Your walk-in collections and remittances.</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total collected" value={formatPeso(summary.currentCollectionCentavos)} />
        <Stat label="Pending remittance" value={formatPeso(summary.pendingRemittanceCentavos)} />
        <Stat label="Total transactions" value={summary.transactionCount} />
        <Stat label="Today's collection" value={formatPeso(summary.todayCollectionCentavos)} />
      </dl>

      <div className="mt-6">
        <RemitButton availableCentavos={summary.availableToRemitCentavos} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify by hand**

Sign in as the staff account. Record a walk-in sale via `/admin/walk-in`,
return to `/admin/cashier` — "Total collected" and "Total transactions"
reflect it, "Today's collection" includes it.

- [ ] **Step 3: Commit**

(Bundled with Task 9's commit, since `RemitButton` doesn't exist until then
— write this task's page first, stub `RemitButton` as a no-op button, then
finish it in Task 9. Or do Tasks 8 and 9 as one working session before
committing either — implementer's call, both are small.)

---

## Task 9: Remit cash

**Files:**
- Create: `src/app/admin/cashier/remit-button.tsx`
- Create: `src/app/admin/cashier/actions.ts`
- Create: `src/lib/remittances/queries.ts`

**Interfaces:**
- Produces: `createRemittance(staffId: string, amountCentavos: number): Promise<CreateRemittanceResult>`, `submitRemittance(amountCentavos: number): Promise<ActionResult>`

- [ ] **Step 1: Write the remittance creation query**

Create `src/lib/remittances/queries.ts`:

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { CashRemittance } from "@/lib/supabase/types";
import { staffCashSummary } from "@/lib/cash/queries";

export type CreateRemittanceResult =
  | { ok: true; id: string }
  | { ok: false; error: "exceeds_available" | "failed" };

/**
 * Re-derives availableToRemit at submit time and rejects anything over it —
 * see this plan's Design decisions #9 for why this is a recheck, not a lock.
 */
export async function createRemittance(
  staffId: string,
  amountCentavos: number,
): Promise<CreateRemittanceResult> {
  const summary = await staffCashSummary(staffId);
  if (amountCentavos > summary.availableToRemitCentavos) {
    return { ok: false, error: "exceeds_available" };
  }

  const { data, error } = await adminClient()
    .from("cash_remittances")
    .insert({ staff_id: staffId, amount: amountCentavos })
    .select("id")
    .single();

  if (error) {
    console.error("createRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  return { ok: true, id: data.id };
}

export async function listStaffRemittances(staffId: string): Promise<CashRemittance[]> {
  const { data } = await adminClient()
    .from("cash_remittances")
    .select("*")
    .eq("staff_id", staffId)
    .order("submitted_at", { ascending: false });
  return (data as CashRemittance[]) ?? [];
}
```

- [ ] **Step 2: Write the server action**

Create `src/app/admin/cashier/actions.ts`:

```ts
"use server";

import { currentProfile } from "@/lib/supabase/server";
import { createRemittance } from "@/lib/remittances/queries";
import { logActivity } from "@/lib/activity/queries";
import { formatPeso } from "@/lib/config/event";

export type ActionResult = { ok: boolean; error?: string };

export async function submitRemittance(amountCentavos: number): Promise<ActionResult> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "staff") {
    return { ok: false, error: "Sign in again." };
  }
  if (!Number.isInteger(amountCentavos) || amountCentavos <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }

  const result = await createRemittance(profile.id, amountCentavos);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "exceeds_available"
          ? "You can't remit more than your available collected cash."
          : "Something went wrong. Try again in a moment.",
    };
  }

  await logActivity({
    userId: profile.id,
    activityType: "remittance_submitted",
    description: `${profile.fullName} submitted a cash remittance of ${formatPeso(amountCentavos)}`,
    remittanceId: result.id,
    amount: amountCentavos,
  });

  return { ok: true };
}
```

- [ ] **Step 3: Write the confirm-and-submit UI**

Create `src/app/admin/cashier/remit-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/config/event";
import { submitRemittance } from "./actions";

export function RemitButton({ availableCentavos }: { availableCentavos: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (availableCentavos <= 0) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded bg-accent px-6 py-3 font-semibold uppercase tracking-wide text-white"
      >
        Remit Cash
      </button>
    );
  }

  function onConfirm() {
    startTransition(async () => {
      const result = await submitRemittance(availableCentavos);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-ground/20 bg-ground/5 p-5">
      <h2 className="font-display text-xl uppercase">Cash Remittance</h2>
      <p className="mt-2 text-ground/70">Amount to remit:</p>
      <p className="text-3xl font-bold tabular-nums">{formatPeso(availableCentavos)}</p>
      {error ? <p className="mt-2 text-sm font-medium text-accent">{error}</p> : null}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit Remittance"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="px-5 py-2.5 text-ground/70">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

Remits the full `availableCentavos` rather than a free-typed amount — the
requirements' worked examples always remit the full balance, and a partial-
amount input adds a whole new validation surface (can't exceed available,
must be positive, must be whole pesos) for a need nothing in the spec
actually states. If partial remittance turns out to be wanted, this is a
small follow-up: swap the confirm screen's static amount for a bounded
number input.

- [ ] **Step 4: Show remittance status on the dashboard**

Below the `RemitButton` in `cashier/page.tsx`, list recent remittances via
`listStaffRemittances(profile.id)` — a simple `<ul>` (three items are the
whole spec's example) showing amount, `formatDateTimePH(submitted_at)`, and
status as a text badge ("PENDING ADMIN APPROVAL" / "APPROVED" / "REJECTED —
`rejection_reason`"). This is small enough not to need its own component or
task.

- [ ] **Step 5: Verify by hand — the full pending/approved sequence**

1. As staff, record a ₱250 walk-in sale. "Total collected" → ₱250.
2. Click Remit Cash → confirm ₱250 → Submit. "Total collected" stays ₱250,
   "Pending remittance" → ₱250 (this is the spec's example — confirm it
   does **not** zero out).
3. Try to remit again → button is hidden (`availableCentavos` is now 0).
4. (After Task 10 exists) Admin approves the remittance → refresh the staff
   dashboard → "Total collected" → ₱0, "Pending remittance" → ₱0.

- [ ] **Step 6: Build, test, commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: let staff submit and track cash remittances"
```

---

## Task 10: Admin Cash Remittance Management

**Files:**
- Create: `src/app/admin/cash/page.tsx`
- Create: `src/app/admin/cash/actions.ts`
- Modify: `src/lib/remittances/queries.ts` — add `listAllRemittances`, `approveRemittance`, `rejectRemittance`

**Interfaces:**
- Produces: `listAllRemittances(): Promise<(CashRemittance & { staffName: string })[]>`, `approveRemittance(id: string, adminId: string): Promise<ActionResult>`, `rejectRemittance(id: string, adminId: string, reason: string): Promise<ActionResult>`

This is the second task worth extra care: the anti-double-approval guard
(requirement §16 rule 8) has to be a property of the `UPDATE` itself, not a
read-then-write check in application code, or two admins clicking Approve
within the same second could both succeed.

- [ ] **Step 1: Add the remaining remittance queries**

In `src/lib/remittances/queries.ts`, add:

```ts
export async function listAllRemittances(): Promise<(CashRemittance & { staffName: string })[]> {
  const [{ data: remittances }, { data: staff }] = await Promise.all([
    adminClient().from("cash_remittances").select("*").order("submitted_at", { ascending: false }),
    adminClient().from("profiles").select("id, full_name"),
  ]);

  const names = new Map((staff ?? []).map((row) => [row.id, row.full_name as string]));
  return ((remittances as CashRemittance[]) ?? []).map((row) => ({
    ...row,
    staffName: names.get(row.staff_id) ?? "Unknown",
  }));
}

export type ApproveResult = { ok: true } | { ok: false; error: "already_resolved" | "failed" };

/**
 * The `.eq("status", "pending")` in the WHERE clause is the whole guard
 * against approving (or rejecting) a remittance twice — Postgres commits
 * this as one atomic statement, so two concurrent approve calls can't both
 * match the same still-pending row. `.select().single()` after an UPDATE
 * with no matching row returns an error, which is how a lost race is told
 * apart from a real failure.
 */
export async function approveRemittance(id: string, adminId: string): Promise<ApproveResult> {
  const { data, error } = await adminClient()
    .from("cash_remittances")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: adminId })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("approveRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "already_resolved" };
  return { ok: true };
}

export async function rejectRemittance(
  id: string,
  adminId: string,
  reason: string,
): Promise<ApproveResult> {
  const { data, error } = await adminClient()
    .from("cash_remittances")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("rejectRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "already_resolved" };
  return { ok: true };
}
```

Note `approved_by`/`rejected_by` naming: the migration only has
`approved_by` (no `rejected_by` column — the requirements schema doesn't
ask for one, and `activity_logs` already records which admin rejected which
remittance via `user_id`, so it's not lost, just not duplicated onto
`cash_remittances` itself).

- [ ] **Step 2: Write the server actions**

Create `src/app/admin/cash/actions.ts`:

```ts
"use server";

import { currentProfile } from "@/lib/supabase/server";
import { approveRemittance, rejectRemittance } from "@/lib/remittances/queries";
import { logActivity } from "@/lib/activity/queries";
import { getProfile } from "@/lib/profiles/queries";
import { formatPeso } from "@/lib/config/event";
import { adminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; error?: string };

async function requireAdmin() {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

export async function approve(remittanceId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };

  const { data: remittance } = await adminClient()
    .from("cash_remittances")
    .select("staff_id, amount")
    .eq("id", remittanceId)
    .maybeSingle();

  const result = await approveRemittance(remittanceId, admin.id);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_resolved"
          ? "This remittance was already approved or rejected."
          : "Something went wrong. Try again.",
    };
  }

  const staffProfile = remittance ? await getProfile(remittance.staff_id) : null;
  await logActivity({
    userId: admin.id,
    activityType: "remittance_approved",
    description: `${admin.fullName} approved ${staffProfile?.fullName ?? "a staff member"}'s remittance of ${formatPeso(remittance?.amount ?? 0)}`,
    remittanceId,
    amount: remittance?.amount,
  });

  return { ok: true };
}

export async function reject(remittanceId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };
  if (!reason.trim()) return { ok: false, error: "Give a reason." };

  const { data: remittance } = await adminClient()
    .from("cash_remittances")
    .select("staff_id, amount")
    .eq("id", remittanceId)
    .maybeSingle();

  const result = await rejectRemittance(remittanceId, admin.id, reason);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_resolved"
          ? "This remittance was already approved or rejected."
          : "Something went wrong. Try again.",
    };
  }

  const staffProfile = remittance ? await getProfile(remittance.staff_id) : null;
  await logActivity({
    userId: admin.id,
    activityType: "remittance_rejected",
    description: `${admin.fullName} rejected ${staffProfile?.fullName ?? "a staff member"}'s remittance of ${formatPeso(remittance?.amount ?? 0)}: ${reason}`,
    remittanceId,
    amount: remittance?.amount,
  });

  return { ok: true };
}
```

- [ ] **Step 3: Build the page**

Create `src/app/admin/cash/page.tsx` — five `Stat` cards (reusing Task 6's
functions and `totalCollectedCentavos()`/`approvedCount()` from
`scans/queries.ts`), then a `Table`/`Tr` (from `admin/table.tsx`) listing
`listAllRemittances()` with Approve/Reject buttons on `pending` rows only
(`—` for resolved ones, matching the requirement's own example table).
Approve is a single click calling `approve(id)`; Reject opens a small
reason prompt (a plain `window.prompt` is enough here — this is an
internal admin action taken rarely, not a polished student-facing flow —
or a minimal inline text input if the implementer prefers; either is fine,
keep it small) before calling `reject(id, reason)`. Both call
`router.refresh()` on success.

- [ ] **Step 4: Verify by hand — the worked example from the requirements**

Reproduce requirement §8's numbers exactly:

1. Staff A collects ₱3,000 (walk-ins), Staff B collects ₱2,000, an Admin
   records ₱5,000 directly. Confirm: Total Event Collection ₱10,000, Admin
   Current Collection ₱5,000, Staff Cash on Hand ₱5,000.
2. Staff A remits ₱3,000, Admin approves it. Confirm: Total Event
   Collection **still** ₱10,000, Admin Current Collection → ₱8,000, Staff
   Cash on Hand → ₱2,000.
3. Try approving the same remittance a second time (e.g. two browser tabs,
   or re-submit the form after approving) → "This remittance was already
   approved or rejected," no second transfer.

- [ ] **Step 5: Build, test, commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: add admin cash remittance management page"
```

---

## Task 11: Staff's own activity log

**Files:**
- Create: `src/app/admin/cashier/activity/page.tsx`

**Interfaces:**
- Consumes: `currentProfile`, `listOwnActivity`, `describeActivity`, `formatDateTimePH`

- [ ] **Step 1: Build the page**

A read-only `Table` (from `admin/table.tsx`) over `listOwnActivity(profile.id)`,
columns: Activity (`describeActivity(row.activity_type)`), Description,
Amount (`formatPeso` when non-null), Date/Time (`formatDateTimePH`). No
edit or delete affordance anywhere on the page — there's no server action
that could do either, so this isn't just a UI omission.

- [ ] **Step 2: Verify by hand**

As staff, confirm the page shows only this staff member's own rows —
record a walk-in as a *different* staff account (or check via the SQL
editor) and confirm it does not appear here.

- [ ] **Step 3: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: add staff activity log page"
```

---

## Task 12: Admin activity log with filters

**Files:**
- Create: `src/app/admin/activity/page.tsx`
- Create: `src/app/admin/activity/activity-filters.tsx`

**Interfaces:**
- Consumes: `listActivity`, `listStaffProfiles`, `ACTIVITY_TYPES`, `describeActivity`

- [ ] **Step 1: Build the filter bar**

`activity-filters.tsx`, client component, same debounce-and-navigate
pattern as `scan-filters.tsx`/`registration-filters.tsx` (URL search params,
no submit button): a date-range control (Today / Yesterday / This Week /
This Month / Custom — custom reveals two date inputs), a Staff `<select>`
populated from `listStaffProfiles()` ("All Staff" default), an Activity Type
`<select>` from `ACTIVITY_TYPES` via `describeActivity()` for labels, and a
text search box (student name/ID/description, per Task 2 Step 6's note).

- [ ] **Step 2: Build the page**

Server Component reading `searchParams`, translating them into
`ActivityFilters`, calling `listActivity(filters)`, rendering a `Table` with
columns: Activity Type, Description, User, Role, Amount, Date, Time,
Transaction (linking `registration_id`/`remittance_id` when present, using
the truncated-UUID display from Design decision #7).

- [ ] **Step 3: Verify by hand**

Filter by a specific staff member → only their rows. Filter by "Login" →
only login rows across everyone. Search a student's name → the matching
walk-in/approval/rejection rows (relies on Task 2's decision to embed the
name in `description` at write time — confirm it actually matches).

- [ ] **Step 4: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: add admin activity log with filters"
```

---

## Task 13: Admin visibility into all walk-in payments

**Files:**
- Modify: `src/app/admin/registrations/page.tsx`
- Modify: `src/app/admin/registrations/registration-filters.tsx`
- Modify: `src/lib/registrations/queries.ts` — `searchRegistrations` gains an optional `paymentMethod` filter

**Interfaces:**
- Consumes/modifies: `searchRegistrations(query, status?, paymentMethod?)`

- [ ] **Step 1: Extend the query**

In `searchRegistrations` (`src/lib/registrations/queries.ts`), add an
optional third parameter `paymentMethod?: "all" | PaymentMethod` mirroring
how `status` already works — `if (paymentMethod && paymentMethod !== "all")
builder = builder.eq("payment_method", paymentMethod)`.

- [ ] **Step 2: Add the filter pill and column**

In `registration-filters.tsx`, add a "Walk-in only" pill/select alongside
the existing status pills — same URL-param pattern. In the results table
(`registrations/page.tsx`), add an "Added By" column, populated the same
way `reviewed_by`→email is already resolved elsewhere (`listAdminEmails`,
or now `listStaffProfiles`/`getProfile` for a name instead of an email,
since Staff accounts have `full_name` where before every account was just
an admin identified by email). Show it only when the row's
`payment_method === "walk_in"` (an online row's `reviewed_by` means
something different — who approved it, not who "added" it).

- [ ] **Step 3: Verify by hand**

Filter to Walk-in only → every row shows an "Added By" name, matching
whichever staff/admin account recorded it.

- [ ] **Step 4: Build, test, commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: filter and attribute walk-in payments on Find a registration"
```

---

## Task 14: Final verification pass

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite and build**

```powershell
npm test
npm run build
```

- [ ] **Step 2: Re-walk every business rule in requirements §16**

Using two browser sessions (one staff, one admin) against a running
`npm run dev`, confirm each of the 20 rules holds — most were already
exercised task-by-task above; this pass is about doing them **in
combination**, in one continuous session, the way an actual event night
would: staff records several walk-ins, submits a remittance, admin
approves one and rejects another (with a reason), staff sees the rejected
one's cash return to "available," admin's dashboard numbers stay internally
consistent (`Task 6 Step 6`'s equation) throughout.

- [ ] **Step 3: Update `docs/setup/supabase.md` "Before launch" checklist**

Add: every real staff member needs both an `auth.users` row and a matching
`profiles` row created by hand before event day (Task 1 Step 3's process) —
there's no self-service signup for this either.

- [ ] **Step 4: Update `context/SCHEMA.md`**

Add sections for `profiles`, `cash_remittances`, and `activity_logs`
following the existing file's format (columns table, constraints,
indexes, the "why" behind each non-obvious choice) — the file's own header
says migrations are the source of truth but it needs updating alongside
them.

- [ ] **Step 5: Final commit**

```powershell
git add -A
git commit -m "docs: document staff roles and cash remittance schema"
```
