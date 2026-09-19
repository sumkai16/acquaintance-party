# Confirmation emails via Resend (optional, but worth setting up)

**Status as of 2026-09-06: blocked on a domain.** `RESEND_FROM_EMAIL` is
currently `onboarding@resend.dev` (no verified domain on the account), which
means Resend silently rejects every send to anyone but the account's own
signup address — confirmed by calling the Resend API directly with the
project's real key. This is not a code bug; step 2 below is the actual fix
and needs a real domain registered (a `vercel.app` subdomain doesn't
qualify — only Vercel controls DNS for that). Once a domain is bought:
Resend → **Domains → Add Domain**, add the DNS records it gives you
wherever that domain's DNS is hosted (Vercel's own Domains/DNS tab if
bought through Vercel), wait for verification, then update
`RESEND_FROM_EMAIL` to an address on it and redeploy. `email_failed`
activity-log rows (added this session — see `src/lib/activity/types.ts`)
will keep surfacing this in `/admin/activity` until it's fixed, instead of
failing silently.

**Nobody emailed in the meantime is lost.** Every approval since sales opened
is queued rather than forgotten: `registrations.ticket_email_sent_at`
(migration `0009`) stays null until a send is actually accepted, and the
Dashboard carries a **Ticket emails — Send to N** button that mails the QR to
everyone still null, oldest first. It refuses to run while
`RESEND_FROM_EMAIL` is still an `@resend.dev` address, because that sender
can have a send *accepted* and dropped afterwards — which would mark hundreds
of students as emailed when nothing arrived. So the order is: buy the domain,
verify it, set `RESEND_FROM_EMAIL`, redeploy, then press the button. On the
free plan it sends 100 a day; press it again the next day for the rest.

Sends two emails to a student: one right after checkout ("we received this,
here's your permanent link, keep it"), and one when an admin approves the
ticket. This is the only copy of the ticket link that reaches the student
outside the browser tab they're sitting in at the moment of checkout — if
that tab closes before they bookmark the page, this is what they have.

**Skip it and nothing breaks.** If `RESEND_API_KEY` or `NEXT_PUBLIC_SITE_URL`
is missing, sending is skipped silently — checkout and approval both work
exactly the same either way, matching the Discord webhook's "not configured,
not an error" contract.

## 1. Create an account and get an API key

1. https://resend.com → sign up.
2. **API Keys → Create API Key**. Sending access is enough; no domain
   verification needed to start.
3. Copy the key — shown once.

## 2. Choose a sending address

- **No domain to verify yet:** use `onboarding@resend.dev` as
  `RESEND_FROM_EMAIL`. Works immediately, free tier covers this event's
  volume (100/day, 3,000/month against maybe 600 tickets total), but the
  email will show as sent "via resend.dev."
- **A domain the department controls:** **Domains → Add Domain** in Resend,
  add the DNS records it gives you, wait for verification, then send from
  something like `tickets@yourdomain.org`. Looks official, better
  deliverability. Not required to launch — swap it in later without touching
  code, it's just an env var.

**Either way, set a display name** so the inbox shows something better than
the raw address (Gmail otherwise shows "onboarding," which reads as
generic/unofficial). `RESEND_FROM_EMAIL` accepts the standard
`"Name <email>"` format directly — no code change needed:
```
RESEND_FROM_EMAIL="Itech Society <onboarding@resend.dev>"
```
Quote it (the value contains spaces and angle brackets).

## 3. Set the environment variables

Add to `.env.local` and, for production, Vercel's **Settings → Environment
Variables**:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the key from step 1 |
| `RESEND_FROM_EMAIL` | optional — defaults to `onboarding@resend.dev` if unset |

**`NEXT_PUBLIC_SITE_URL` must also be set** (same var the Discord
notification already uses for its review-queue link) — without it, sending
is skipped entirely rather than emailing a broken link. See
`docs/setup/supabase.md` for where this is already documented as a
production-only var.

Redeploy after adding these — env vars are baked in at deploy time.

## 4. Check it works

1. Submit a real (or throwaway) registration through `/checkout`.
2. An email should arrive at the address you typed within a few seconds,
   with a working link to the ticket page.
3. Approve that registration from `/admin/review`.
4. A second email — "your ticket is approved" — should arrive.

If nothing arrives, check the server logs:
- `Resend responded with an error` — check the API key and that
  `RESEND_FROM_EMAIL` is either `onboarding@resend.dev` or a verified domain.
- Nothing logged at all, nothing sent — `RESEND_API_KEY` or
  `NEXT_PUBLIC_SITE_URL` is probably unset; sending is skipped by design in
  that case, not failing loudly.

None of this affects checkout or approval on its own. That's the point.

## 5. Webhook — catching a bounce Resend already knew about

**Status as of 2026-09-19.** `ticket_email_sent_at` / `receipts.emailed_at`
are stamped the moment Resend *accepts* a send (see step 4's own "check it
works" and the schema comments) — never once checked back on whether the
mailbox actually got it. Confirmed on production: several walk-in tickets
sent right after each other, all synchronously "accepted" with no error,
and Resend's own delivery log later showed three of them as `bounced`. The
Dashboard kept showing "QR sent" for all three anyway, because nothing told
it otherwise.

`src/app/api/webhooks/resend/route.ts` closes that gap — Resend calls it
the moment a send it already accepted turns out to have bounced, and it
puts that registration's ticket/receipt back in the queue (same "null is
the queue" contract `markTicketEmailSent` already uses) with an
`email_failed` row in `/admin/activity` explaining why. It only works for
mail that carries a `registration_id` tag — every send this app tracks a
"sent" flag for already does (see `src/lib/notify/email.ts`).

To turn it on:

1. **Resend → Webhooks → Add Endpoint.**
2. **Endpoint URL:** `https://itech2026.site/api/webhooks/resend`
   (must be the live deployment — Resend can't reach `localhost`).
3. **Events to send:** tick `email.bounced` only. (Nothing else is handled;
   ticking more just means Resend calls an endpoint that no-ops on them.)
4. Save, then copy the **Signing Secret** it shows you (`whsec_...`).
5. Add it as `RESEND_WEBHOOK_SECRET` in Vercel's **Settings → Environment
   Variables**, redeploy.

Skip it and nothing breaks — sending still works exactly as before, the
route just returns 500 until configured (fails closed, not silently). But
until it's set, a bounce still shows as "sent" with nothing to catch it,
same as before this section existed.
