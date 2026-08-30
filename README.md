# Acquaintance Party ticketing

An e-commerce-style ticketing system: landing page → checkout with GCash proof
of payment → admin approval → QR ticket → door scanner → raffle.

Start with `CLAUDE.md` — it points at `context/` (fast-reference rules,
architecture, design tokens, schema, scope) and `docs/superpowers/` (the full
reasoning behind each decision):
- `context/` — RULES.md, ARCHITECTURE.md, DESIGN.md, PRD.md, SCHEMA.md
- `docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md` — the full design
- `docs/superpowers/plans/2026-08-30-sell-and-verify.md` — the current implementation plan
- `docs/setup/supabase.md` — hosted Supabase project setup (dashboard clicks, not code)

## Run it

```
npm run dev
```

Opens at http://localhost:3000. Requires `.env.local` (copy from
`.env.local.example` and fill in your Supabase project's URL and keys).

Stop it with **Ctrl+C** in that terminal. Only one `npm run dev` can hold
port 3000 at a time — if you see "port already in use" or a proxy/middleware
conflict error, an old instance is still running; stop it first.

## Test it

```
npm test          # run the unit test suite once
npm run test:watch  # re-run on file changes, while writing code
npm run build      # production build — also catches type errors the dev server won't
```

Unit tests cover the pure logic: ticket code generation, GCash reference
validation, the checkout schema. They do not open a browser — clicking
through the actual pages (checkout, admin review, the ticket page) is manual,
by hand, against `npm run dev`.

## Project layout

- `src/lib/config/` — event details and theme tokens. Edit these, not
  components, when the event or the theme changes.
- `src/lib/tickets/`, `src/lib/registrations/` — pure logic and data access,
  unit tested.
- `src/lib/supabase/` — three clients: service-role (server actions only),
  session-aware (admin pages), anon (browser, login page only).
- `src/app/` — routes. Each route folder owns its own server actions and
  client components.
- `supabase/migrations/` — schema, applied by pasting into the Supabase SQL
  editor (see `docs/setup/supabase.md` — there is no local Supabase stack on
  this machine, so the CLI's `db push` isn't used).
