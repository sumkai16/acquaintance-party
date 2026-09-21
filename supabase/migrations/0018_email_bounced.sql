-- When Resend last reported that an email to this registration's address
-- bounced, failed or was suppressed.
--
-- ticket_email_sent_at already goes back to null on a bounce (the send queue),
-- but null also means "never sent yet", so the Dashboard couldn't tell a
-- mistyped or dead address from someone simply not emailed. This is that
-- difference: set by the Resend webhook, cleared when staff change the
-- address or a later send is accepted. Null is the normal state.
alter table registrations add column email_bounced_at timestamptz;
