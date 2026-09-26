-- A partial walk-in payer can now be sent their QR before the balance is
-- paid (an admin does it from Outstanding balances on /admin/walk-in): the
-- row stays `partial` — so every cash total and the Outstanding balances
-- list keep treating it as money still owed — but it may carry a
-- ticket_code, which is what the door scanner admits on.
--
-- Was (0001_init.sql): approved <=> ticket_code present. Now approved still
-- requires one; partial may have one or not; every other status has none.
-- Written with status::text, like 0013, so it doesn't lean on the enum
-- literal directly.
--
-- Safe to re-paste.

alter table registrations drop constraint if exists ticket_code_matches_status;
alter table registrations add constraint ticket_code_matches_status check (
  case
    when status::text = 'approved' then ticket_code is not null
    when status::text = 'partial' then true
    else ticket_code is null
  end
);
