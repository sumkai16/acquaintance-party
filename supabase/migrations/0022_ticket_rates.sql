-- Discounted and complimentary tickets for officers — see
-- src/lib/registrations/rates.ts for the prices.
--
-- `amount` keeps meaning "what this ticket costs its holder", so every cash
-- total (which sums amount_paid) and every approved total (which sums
-- amount) stays correct without special cases: an officer ticket counts
-- ₱250, a free one ₱0.
--
-- Only an admin can record a non-regular rate, and only through the single
-- walk-in form — enforced in src/app/admin/walk-in/actions.ts, not here.
--
-- Safe to re-paste: every step is guarded.

alter table registrations
  add column if not exists ticket_rate text not null default 'regular';

alter table registrations drop constraint if exists registrations_ticket_rate_check;
alter table registrations add constraint registrations_ticket_rate_check
  check (ticket_rate in ('regular', 'officer', 'free'));

-- Was `amount > 0` (0001_init.sql). A free ticket is a real ₱0 ticket.
alter table registrations drop constraint if exists registrations_amount_check;
alter table registrations add constraint registrations_amount_check
  check (amount >= 0);

-- ₱0 only ever means a free ticket, and a free ticket is only ever ₱0 — so a
-- ₱0 regular row can't slip in by mistake.
alter table registrations drop constraint if exists ticket_rate_matches_amount;
alter table registrations add constraint ticket_rate_matches_amount
  check ((ticket_rate = 'free') = (amount = 0));
