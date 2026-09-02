-- Raffle draws.
--
-- Prizes are NOT a table. They live in RAFFLE_PRIZES in
-- src/lib/config/event.ts, so a draw references one by a stable string key
-- and snapshots the prize name — a later config edit never rewrites history.
--
-- `finalists` snapshots each shortlisted student rather than storing bare
-- ids. This row records what was announced on stage, not a live view of
-- current data: a past draw redisplays with no join (so the projector
-- survives a connection drop), and a later name correction never silently
-- changes what the emcee actually said. The winner is always one of the
-- finalists, so their display data is read out of that snapshot.
--
-- One invariant this table cannot enforce: "the winner is one of the
-- finalists" needs a subquery, which Postgres forbids in CHECK. It holds
-- because the draw function picks the winner from the finalists array it
-- returns, but a hand-written insert here could still break it.

create table raffle_draws (
  id                     uuid primary key default gen_random_uuid(),
  prize_key              text not null check (length(trim(prize_key)) > 0),
  prize_name             text not null check (length(trim(prize_name)) > 0),
  winner_registration_id uuid not null references registrations (id),
  finalists              jsonb not null,
  pool_size              integer not null check (pool_size > 0),
  drawn_at               timestamptz not null default now(),
  drawn_by               uuid not null references auth.users (id),
  is_redraw              boolean not null default false,
  supersedes             uuid references raffle_draws (id),

  -- A row with no finalists did not come from a draw.
  constraint finalists_is_small_array check (
    jsonb_typeof(finalists) = 'array'
    and jsonb_array_length(finalists) between 1 and 12
  ),

  -- A redraw must say what it replaced; a fresh draw must not point anywhere.
  constraint redraw_has_supersedes check (is_redraw = (supersedes is not null))
);

create index raffle_draws_prize_key_idx on raffle_draws (prize_key, drawn_at desc);
create index raffle_draws_winner_idx on raffle_draws (winner_registration_id);

-- One draw can be superseded at most once, so the history stays a chain
-- rather than a tree nobody can read back.
create unique index raffle_draws_supersedes_key
  on raffle_draws (supersedes)
  where supersedes is not null;

alter table raffle_draws enable row level security;

create policy "admins read raffle_draws" on raffle_draws
  for select to authenticated using (true);

-- No insert policy on any role: draws are written by the service-role client
-- from a server action, matching registrations and scans.
