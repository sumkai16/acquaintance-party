-- One written reply per help request, sent from /admin/email-fixes. The
-- student sees it on their ticket page and by email — admins can't answer
-- through the Facebook page (the instructors run it), so this is the
-- two-way half of 0024's "Report a QR problem".
--
-- Paste BEFORE deploying the code that uses it: until then "Send reply" on
-- the queue fails to save (the ticket page just shows no reply — its read
-- fails soft). Safe to paste twice.
alter table email_correction_requests
  add column if not exists reply text
    check (reply is null or char_length(reply) <= 1000),
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references auth.users (id);

-- Backs latestHelpReply(): the ticket page's "newest reply for this
-- registration" read.
create index if not exists email_correction_requests_reply_idx
  on email_correction_requests (registration_id, replied_at desc)
  where reply is not null;
