-- Admin-managed prizes and a manual/imported entrant supplement.
--
-- Prizes were a hardcoded RAFFLE_PRIZES list in src/lib/config/event.ts —
-- changing one needed a code edit and a redeploy. They move into a table the
-- operator manages from /admin/raffle instead.
--
-- raffle_draws.prize_key needs no column change: it already stored an
-- opaque string (a config slug before, a raffle_prizes.id now), and
-- prize_name is already snapshotted per draw, so renaming or deleting a
-- prize never rewrites history. No FK is added from prize_key to
-- raffle_prizes.id, deliberately — deleting a prize must never be blocked
-- by, or cascade into, its own past results.

create table raffle_prizes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 80),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create index raffle_prizes_sort_order_idx on raffle_prizes (sort_order);

alter table raffle_prizes enable row level security;

create policy "admins read raffle_prizes" on raffle_prizes
  for select to authenticated using (true);

-- No insert/update/delete policy on any role: prizes are written by the
-- service-role client from a server action, matching every other table.

-- Extra entrants: someone the scanner missed but staff can vouch was there,
-- added by hand or via a bulk Excel import. These rows supplement the
-- auto-derived pool of scanned-in students — the scan-based pool stays the
-- default and the primary eligibility path. This is an explicit admin
-- action, not something a student can trigger themselves.

create table raffle_extra_entrants (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  year_level text,
  section    text,
  source     text not null check (source in ('manual', 'import')),
  added_by   uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

alter table raffle_extra_entrants enable row level security;

create policy "admins read raffle_extra_entrants" on raffle_extra_entrants
  for select to authenticated using (true);

-- winner_registration_id previously required a real registrations row. An
-- extra entrant has none, so a winner drawn from that pool can't satisfy
-- the FK. Dropped, not widened — a single FK column can't reference two
-- tables, and `finalists` already snapshots the winner's display data
-- directly, so the FK was never load-bearing for anything the app reads.
--
-- Before running the next line, confirm the actual constraint name:
--   select conname from pg_constraint where conrelid = 'raffle_draws'::regclass;
-- Postgres names an inline `references` this way by default
-- (<table>_<column>_fkey), but verify rather than assume before dropping it.
alter table raffle_draws
  drop constraint raffle_draws_winner_registration_id_fkey;
