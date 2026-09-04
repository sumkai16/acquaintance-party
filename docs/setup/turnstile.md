# Bot protection on checkout via Cloudflare Turnstile (optional, but recommended)

Checkout already has two anti-spam levers: a per-email throttle (three
submissions per 15 minutes) and the unique GCash reference index. Neither
stops a script that rotates a fresh fake email and reference on every
request — Turnstile adds a check that's much harder to script around, while
staying invisible to a real student almost all the time.

**Skip it and nothing breaks.** If `TURNSTILE_SECRET_KEY` is unset,
`verifyTurnstileToken()` skips the check entirely; if
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, the widget doesn't render at all.
Checkout works exactly the same either way, matching every other optional
integration's contract in this codebase.

## 1. Create a Turnstile widget

1. https://dash.cloudflare.com → sign in (a free account is enough — you do
   not need to add this site's domain to Cloudflare or touch DNS).
2. Use the **Quick search** box (top of the dashboard, `Ctrl K`) and type
   "Turnstile" — the sidebar location has moved around dashboard redesigns
   before, the search box hasn't.
3. **Turnstile → Add widget manually** (not "Set up with Spin" — that's
   Cloudflare's own AI-agent flow; the manual form takes thirty seconds and
   gives the same two keys).
4. Fill in:
   - **Name** — anything descriptive, e.g. "Acquaintance Party checkout."
   - **Domains** — add the production domain (e.g. `it2026.vercel.app`)
     and `localhost`.
   - **Widget Mode** — **Managed** (Cloudflare's recommended default): a
     real student sees a non-interactive or fully invisible check almost
     every time; only traffic that already looks suspicious gets an
     interactive challenge.
5. **Create**. The next screen shows a **Site Key** and a **Secret Key**.

## 2. Set the environment variables

Add to `.env.local` and, for production, Vercel's **Settings → Environment
Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the Site Key from step 1 — safe to be public, it's embedded in the page |
| `TURNSTILE_SECRET_KEY` | the Secret Key — **server only**, never prefix with `NEXT_PUBLIC_`, never paste it anywhere public |

Restart `npm run dev` locally (env vars are read at server start, not
picked up live), and redeploy on Vercel after adding these there.

## 3. How it's wired in

- `src/app/checkout/checkout-form.tsx` loads Cloudflare's script via
  `next/script` and renders `<div class="cf-turnstile" data-sitekey="...">`
  — only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set. Cloudflare's script
  finds that div and injects a hidden `cf-turnstile-response` input into
  the enclosing form once the check completes.
- `src/lib/turnstile/verify.ts` (`server-only`) posts that token to
  Cloudflare's `siteverify` endpoint. Checked in
  `src/app/checkout/actions.ts` before anything else — before the Zod
  schema, before the throttle, before any upload — so a failed check never
  touches the database or storage.
- A verification-service outage (network error, non-200 response) **fails
  open** — the submission is allowed through rather than blocking a real
  student because Cloudflare had a bad moment. Only an actual bad/missing/
  expired token is a hard reject. Same reasoning as the honeypot removal
  documented in `context/RULES.md`.

## 4. Check it works

1. Load `/checkout` in a real browser (not a scripted request) — you
   shouldn't see anything unusual; Managed mode is invisible for normal
   traffic.
2. Submit a real (or throwaway) registration through to completion — it
   should go through exactly as before Turnstile existed.
3. To confirm the reject path without faking a whole submission, POST
   directly to Cloudflare's `siteverify` endpoint with the real secret key
   and an obviously bogus token:
   ```bash
   curl -s -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
     --data-urlencode "secret=<TURNSTILE_SECRET_KEY>" \
     --data-urlencode "response=bogus"
   ```
   Expected: `{"success":false,"error-codes":["invalid-input-response"], ...}`
   — confirms the secret key is valid and a bad token is correctly rejected.
   An `invalid-input-secret` error instead means the secret key itself is
   wrong — double-check what's in `.env.local`/Vercel against the dashboard.
