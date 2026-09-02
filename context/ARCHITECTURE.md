# ARCHITECTURE.md — System Architecture

## 1. Stack summary
- Frontend: Next.js 16 (App Router), TypeScript, React 19, Tailwind v4
- Backend: Next.js server actions and route handlers — no separate API server
- Database: Supabase Postgres (hosted, no local instance — see §5)
- Storage: Supabase Storage, private `receipts` bucket
- Auth: Supabase Auth, email/password, admin-only (public signup disabled)
- Testing: Vitest, unit tests on pure logic only — no browser test runner
- Hosting: Vercel (required for HTTPS — the door scanner needs camera access,
  which browsers block on insecure origins). Production is
  `https://it2026.vercel.app` (renamed from `acquaintance-party.vercel.app`,
  which no longer resolves).

## 2. High-level overview
Server-rendered Next.js App Router. Every public write (checkout, receipt
upload) goes through a server action using the Supabase **service-role**
client, which bypasses row-level security. Anonymous visitors have no direct
database or storage access at all — RLS only has to describe *admin* access,
because the public path never touches it. Admin pages are gated by a
session-aware Supabase client reading the signed-in user's cookie.

There is no local Supabase stack (no Docker on the dev machine). Schema
changes are written as SQL migration files under `supabase/migrations/` and
applied by hand — see `docs/setup/supabase.md`.

## 3. Design pattern
Thin routes, fat `src/lib/`:
- **Pure logic has no I/O** and lives in `src/lib/tickets/` and
  `src/lib/registrations/schema.ts` — ticket code generation, GCash reference
  validation, the checkout Zod schema, QR rendering. Fully unit tested.
- **Data access** lives in `src/lib/registrations/queries.ts`, one function
  per operation, all using the service-role client, all `import "server-only"`.
- **Server actions** (`src/app/**/actions.ts`) are the only place that calls
  data access from user input. They validate, call `src/lib/`, and return a
  typed result — never throw a raw Supabase error at the client.
- **Client components** are thin — form state and submission only. No
  business logic, no direct Supabase calls.
- **No repository or service layer beyond `src/lib/registrations/queries.ts`.**
  The codebase isn't large enough to justify more indirection.

## 4. Three Supabase clients — know which one you're in
| Client | File | Key | Used from |
|---|---|---|---|
| Service role | `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS | Server actions, `src/lib/registrations/queries.ts` only |
| Session-aware | `src/lib/supabase/server.ts` | anon key + admin's session cookie | Admin Server Components, admin server actions, and the `/api/scan/*` route handlers, all calling `auth.getUser()` to gate access |
| Browser (anon) | `src/lib/supabase/browser.ts` | anon key, no elevated access | `/admin/login` only |

`src/proxy.ts` (Next 16's rename of `middleware.ts`) refreshes the admin
session cookie on every `/admin/*` and `/api/scan/*` request and sets
`x-pathname`, which `src/app/admin/layout.tsx` reads to let `/admin/login`
through its own auth gate without a redirect loop. The proxy only keeps the
cookie fresh — `/api/scan/manifest` and `/api/scan/sync` verify the session
themselves (`serverClient().auth.getUser()`) rather than trusting it, since
route handlers don't go through `admin/layout.tsx`'s gate.

## 5. Why no local Supabase / no CLI-driven migrations
No Docker on this machine, so `supabase start` / `db reset` are unavailable.
Migrations are pasted into the hosted project's SQL editor by hand instead of
pushed with `supabase db push`. This means:
- `supabase/migrations/*.sql` is the source of truth for intended schema, but
  it is **not guaranteed to match production** the way a CLI-tracked
  migration history would — always check `docs/setup/supabase.md` §6 was
  followed for the latest file before assuming it's live.
- Any new migration file needs a manual "paste it in" step documented in
  `docs/setup/supabase.md` at the time it's added.

## 6. Folder structure
```
src/
├── app/
│   ├── page.tsx                  # landing (plain until the polish pass)
│   ├── checkout/
│   │   ├── page.tsx
│   │   ├── checkout-form.tsx     # "use client"
│   │   └── actions.ts            # "use server" — validate, upload, insert
│   ├── ticket/[id]/page.tsx      # student's permanent ticket link
│   ├── admin/
│   │   ├── layout.tsx            # auth gate, reads x-pathname
│   │   ├── login/
│   │   ├── review/               # approve/reject queue
│   │   ├── registrations/        # search, for lost ticket links
│   │   ├── scan/                 # door scanner: page.tsx + scanner.tsx (client)
│   │   ├── raffle/               # projector: page.tsx + actions.ts + client stages
│   │   └── dashboard/            # attendance + double-scan alerts
│   │       └── export/route.ts   # GET, streams .xlsx
│   ├── api/scan/
│   │   ├── manifest/route.ts     # GET, authenticated — approved tickets + check-in state
│   │   └── sync/route.ts         # POST, authenticated, idempotent on client-generated id
│   └── globals.css               # @theme tokens — see context/DESIGN.md
├── lib/
│   ├── config/
│   │   ├── event.ts               # event details — the only file to edit
│   │   └── theme.ts               # colors/fonts — the only file to edit
│   ├── tickets/
│   │   ├── code.ts                # generateTicketCode, formatTicketCode, normalizeScannedCode
│   │   ├── reference.ts           # GCash reference normalize/validate
│   │   └── qr.ts                  # ticketQrDataUrl
│   ├── registrations/
│   │   ├── schema.ts              # checkoutSchema (Zod)
│   │   ├── abuse.ts               # submission throttle (no honeypot — see RULES.md)
│   │   └── queries.ts             # all DB reads/writes
│   ├── scans/
│   │   ├── manifest.ts            # Manifest / ManifestEntry types
│   │   ├── resolve.ts             # pure: ok/duplicate/invalid against a manifest
│   │   ├── report.ts              # pure: attendance summary, cross-device double-scan detection
│   │   ├── queries.ts             # server-only: manifest read, scan upsert, dashboard reads
│   │   ├── store.ts               # client-only: IndexedDB manifest cache + sync queue
│   │   └── camera.ts              # client-only: BarcodeDetector, @zxing/browser fallback
│   ├── raffle/
│   │   ├── types.ts               # RaffleEntrant / RaffleDrawRow
│   │   ├── draw.ts                # pure: crypto shortlist + winner, exclusions
│   │   └── queries.ts             # server-only: eligible pool, record/read draws
│   ├── sheets/
│   │   ├── row.ts                 # pure: one scan as a row of cells
│   │   └── sheets.ts              # publishScans, server-only
│   ├── notify/
│   │   ├── discord-message.ts     # pure formatting, no server-only import
│   │   └── discord.ts             # notifyNewRegistration, server-only
│   └── supabase/
│       ├── admin.ts | server.ts | browser.ts
│       └── types.ts
└── proxy.ts                       # Next 16 middleware rename; matches /admin/* and /api/scan/*
supabase/migrations/                # applied by hand, see docs/setup/supabase.md
```

## 7. Scheduled/background work
Still no server-side cron or queue. The scanner's "background work" is
entirely client-side: `src/app/admin/scan/scanner.tsx` runs two
`setInterval` loops (manifest refresh every 60s, sync-queue retry every 15s)
plus a manual refresh button, all just repeated `fetch` calls against
`/api/scan/*` — nothing scheduled on the server.

The one piece of server-side background work is the Google Sheets append:
`POST /api/scan/sync` calls `publishScans` inside Next's `after()`, so it
runs after the response is already sent and the scanner never waits on
Google. `after()` specifically, not a bare unawaited promise, which Vercel's
runtime can kill once the response is flushed. It is best-effort by design —
see `docs/setup/google-sheets.md`.
