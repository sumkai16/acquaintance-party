-- Widens 0020's "my email is wrong" queue into a general "report a QR
-- problem" queue from /find. Same table, same admin page
-- (/admin/email-fixes, now labelled "Help requests"): a second table would
-- mean a second queue for the same few staff to watch.
--
-- Paste BEFORE deploying the code that uses it: the new /find action writes
-- `category` and `message`, and an insert naming a missing column fails.
-- Pasting early is harmless — every existing row, and every insert the old
-- code makes, is a wrong_email request that carries an address, which is
-- exactly what the default and the new check describe. Safe to paste twice.
alter table email_correction_requests
  add column if not exists category text not null default 'wrong_email'
    check (category in ('wrong_email', 'no_qr', 'paid_pending', 'qr_problem', 'other')),
  add column if not exists message text
    check (message is null or char_length(message) <= 500);

-- Only a wrong_email request has a corrected address to offer.
alter table email_correction_requests
  alter column requested_email drop not null;

alter table email_correction_requests
  drop constraint if exists email_correction_requests_wrong_email_has_address;

alter table email_correction_requests
  add constraint email_correction_requests_wrong_email_has_address
    check (category <> 'wrong_email' or requested_email is not null);
