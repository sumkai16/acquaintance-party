-- Acquaintance party ticketing: initial schema.
--
-- Access model: anonymous clients get NO policies. Every public read and
-- write goes through a Next.js server action using the service-role key,
-- which bypasses RLS. The policies below therefore only describe admin
-- access, and "any authenticated user" means "an admin" because public
-- signup is disabled in the dashboard.

create type registration_status as enum ('pending', 'approved', 'rejected');
create type scan_result as enum ('ok', 'duplicate', 'invalid');

create table registrations (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(trim(full_name)) between 2 and 120),
  year_level      text not null,
  section         text not null,
  email           text not null,
  gcash_reference text not null,
  receipt_path    text not null,
  amount          integer not null check (amount > 0),
  status          registration_status not null default 'pending',
  reject_reason   text,
  ticket_code     text unique,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users (id),

  -- An approved registration must have a ticket; a pending one must not.
  constraint ticket_code_matches_status check (
    (status = 'approved' and ticket_code is not null)
    or (status <> 'approved' and ticket_code is null)
  ),

  -- A rejection must say why, so the student can fix it and resubmit.
  constraint rejection_has_reason check (
    status <> 'rejected' or length(trim(coalesce(reject_reason, ''))) > 0
  )
);

-- The core anti-fraud lever: one GCash transaction, one ticket.
create unique index registrations_gcash_reference_key
  on registrations (gcash_reference);

create index registrations_status_created_idx
  on registrations (status, created_at desc);

create index registrations_email_idx
  on registrations (lower(email));

-- Append-only. Offline scanners sync late, so reconciliation needs the full
-- history rather than a boolean on registrations.
create table scans (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations (id) on delete cascade,
  code_scanned    text not null,
  scanned_at      timestamptz not null,
  synced_at       timestamptz not null default now(),
  device_label    text not null,
  result          scan_result not null
);

create index scans_registration_idx on scans (registration_id);
create index scans_scanned_at_idx on scans (scanned_at);

alter table registrations enable row level security;
alter table scans enable row level security;

create policy "admins read registrations" on registrations
  for select to authenticated using (true);

create policy "admins update registrations" on registrations
  for update to authenticated using (true) with check (true);

create policy "admins read scans" on scans
  for select to authenticated using (true);
