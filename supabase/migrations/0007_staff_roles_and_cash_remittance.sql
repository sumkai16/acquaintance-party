-- Staff accounts, cash remittance, and the system activity log.
--
-- Access model unchanged from every prior migration: authenticated gets
-- broad SELECT (defense in depth), but there is no INSERT/UPDATE policy on
-- any of these tables for any role. Every write goes through a server
-- action using the service-role client, which enforces staff-vs-admin and
-- own-row-only scoping in application code — see context/RULES.md and
-- docs/superpowers/plans/2026-09-06-staff-cashier-and-remittance.md's
-- Global Constraints for why that's deliberate, not an oversight.

create type user_role as enum ('admin', 'staff');
create type remittance_status as enum ('pending', 'approved', 'rejected');

-- One row per Supabase Auth user. Accounts are still created by hand in the
-- dashboard (no signup) — see docs/setup/supabase.md.
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
-- here. No UPDATE or DELETE policy exists for any role, on purpose.
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
