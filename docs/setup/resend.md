# Confirmation emails via Resend (optional, but worth setting up)

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
