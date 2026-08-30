# RULES.md — Coding & Implementation Rules

## Core principles
- **SOLID**, especially Single Responsibility — a server action that does two
  unrelated things gets split.
- **DRY** — extract when logic repeats, not before. This is a small codebase;
  don't build abstractions for a second caller that doesn't exist yet.
- **KISS** — default to the boring, obvious Next.js/Supabase solution. No
  service layer beyond `src/lib/registrations/queries.ts` unless it's
  actually fat.
- **TDD for pure logic.** Everything in `src/lib/tickets/` and
  `src/lib/registrations/schema.ts` was written test-first and stays that
  way — write the failing test, watch it fail, implement, watch it pass.
  There is no browser test runner in this project; UI is verified by hand
  against `npm run dev` (see the plan's per-task "Verify by hand" steps).
- **Never put pure logic in the same file as a `server-only` import.** The
  `server-only` package throws unconditionally when imported outside Next's
  build system — including from Vitest — so a file that imports it cannot be
  unit tested at all, not even the parts of it that don't touch I/O. Hit this
  building `src/lib/notify/`: the Discord message text and the fetch call
  were one file, and the test suite couldn't even load it. Fixed by splitting
  into `discord-message.ts` (pure, tested) and `discord.ts` (`server-only`,
  the network call). Follow that split for anything similar — plan 2's scan
  resolution and plan 3's raffle draw both mix privileged reads with logic
  worth testing in isolation.

## Plan before implementing
No feature or non-trivial modification starts with an edit. Investigate the
existing code and conventions, present the approach and files touched, then
implement. Use plan mode for anything multi-file or design-bearing; skip the
ceremony for a one-line, fully-specified fix.

## Security — read this before touching auth, payments, or storage

**The access model in one sentence: anonymous users get zero RLS policies.**
Every public read and write goes through a server action holding the
service-role key (`src/lib/supabase/admin.ts`), which bypasses RLS entirely.
The RLS policies on `registrations` and `scans` exist only to describe what a
signed-in **admin** can do. If a task seems to need an `anon` policy, that's
a sign the design is wrong — route it through a server action instead.

**`SUPABASE_SERVICE_ROLE_KEY` is server-only, no exceptions:**
- Read only inside `src/lib/supabase/admin.ts`, which starts with
  `import "server-only"`. That import makes the Next.js build fail loudly if
  the module is ever pulled into a client bundle.
- Never prefix it `NEXT_PUBLIC_`. Never import `adminClient` into a file
  under `"use client"`.
- Never paste the key into chat, a commit, a screenshot, or a ticket. If it
  ever leaks, rotate it in the Supabase dashboard (Project Settings → API
  Keys → Roll) before doing anything else — see `docs/setup/supabase.md`.
- **Verify the guard when you touch it.** Confirmed once by deliberately
  importing `adminClient` into a client component and checking the build
  fails with the "cannot be imported from a Client Component module" error.
  A build that *succeeds* with the import present but unused proves nothing —
  Next tree-shakes unreferenced imports, so the check only works wired into
  a real render path.

**Anti-fraud, not incidental validation:**
- The GCash reference number carries a **unique index**
  (`registrations_gcash_reference_key`). This is the primary defense against
  a reused receipt screenshot — don't relax it, don't catch-and-ignore its
  violation (`23505`) anywhere except to report "already used" back to the
  student.
- A failed insert after a successful upload leaves an orphaned file in the
  `receipts` bucket. `src/app/checkout/actions.ts` removes it on every
  failure path. Any new code that uploads-then-inserts needs the same
  cleanup — verified end to end in the checkout task, not assumed.
- **No hidden-field honeypot on checkout, deliberately.** One existed
  briefly; browser/extension autofill filled the off-screen field with a
  real name on a real submission, silently killing it with no error shown —
  confirmed live via a server-side log, not assumed. For a small one-off
  event, blocking a real paying student is worse than the bot traffic a
  honeypot guards against, and the unique reference index already covers the
  realistic threat. If abuse becomes a real problem, reach for the throttle
  window or a timing-based check before a value-based hidden field.
- The `ticket_code_matches_status` and `rejection_has_reason` check
  constraints on `registrations` are backstops, not decoration. Don't work
  around them from application code (e.g. setting `ticket_code` outside
  `approveRegistration`) — if a legitimate case needs to, the constraint
  needs to change, with a reason recorded in the migration.

**QR rendering has one hard rule.** It renders as a PNG data URL
(`ticketQrDataUrl`), never as injected markup — one less thing to sanitize,
and it keeps the QR on plain white regardless of the surrounding theme (see
`context/DESIGN.md`). If a future task seems to call for raw HTML injection,
that's a sign to find another representation, not to reach for one.

## Error handling
- Server actions return a typed result (`{ ok: true, ... } | { ok: false,
  error: ... }`), never throw a raw Supabase/Postgres error at the client.
- Every message a student or admin sees is a complete sentence they can act
  on — "The GCash reference number is 13 digits," not "invalid_reference."
- Log server-side failures (`console.error`) before returning a generic
  message; never swallow an error silently.
- Constraint violations are inspected by SQLSTATE code (`error.code ===
  "23505"`), not by string-matching the message.

## Naming
- Variables/functions: camelCase (`registrationId`, `formatTicketCode()`)
- Files: kebab-case for components (`checkout-form.tsx`), camelCase for
  logic modules (`code.ts`, `queries.ts`)
- DB tables/columns: snake_case (`gcash_reference`, `ticket_code`)
- Types: PascalCase (`Registration`, `CheckoutInput`)
- Server action files are always `actions.ts` inside the route folder they
  serve, never shared across routes.

## Testing
Run before every commit:
```
npm test        # unit suite — pure logic only
npm run build    # also catches type errors the dev server misses
```
A task isn't done until both pass and the plan's "Verify by hand" steps have
actually been clicked through in a browser — not just assumed from a passing
build.
