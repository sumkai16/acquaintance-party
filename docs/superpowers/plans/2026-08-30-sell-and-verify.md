# Sell & Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student can buy a ticket with GCash proof of payment, an admin can approve or reject it, and the approved student gets a scannable QR ticket at a permanent link.

**Architecture:** Next.js 15 App Router on Vercel with Supabase Postgres, private Storage, and Auth. All public writes go through server actions holding the service-role key — anonymous clients get no direct table or bucket access at all, so RLS only has to describe admin access. Pure logic (code generation, reference validation) lives in `src/lib/` with unit tests; React components stay thin.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Zod, `qrcode`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`

**Plan 1 of 3.** Plan 2 covers door operations (scanner, sync, dashboard, xlsx export). Plan 3 covers Google Sheets sync, landing polish, and the raffle wheel. This plan alone produces a system that can sell and verify tickets.

## Global Constraints

- **Node 24, npm 11.** Both confirmed present.
- **No Docker on this machine.** There is no local Supabase stack. Migrations are written as SQL files and pushed to the hosted project with `npx supabase db push`. Never write a step that requires `supabase start` or `supabase db reset`.
- **No Supabase CLI installed globally.** Always invoke as `npx supabase@latest`.
- **Windows + PowerShell.** Shell steps in this plan are PowerShell. `&&` is not available — use `;` or separate commands.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It must never appear in a file under a `"use client"` directive, never be prefixed `NEXT_PUBLIC_`, and never be imported into a component. Only `src/lib/supabase/admin.ts` may read it.
- **Anonymous users get zero RLS policies.** Every public read and write goes through a server action. If you find yourself writing an `anon` policy, stop — the design is wrong.
- **Never use `dangerouslySetInnerHTML`.** The QR renders as an `<img>` with a data URL. There is no case in this project that needs raw HTML injection.
- **Ticket QR renders as pure black on pure white with a quiet zone.** Never on a themed, tinted, or textured ground. This is a camera constraint, not a style preference.
- **Amount is stored in centavos** as an `integer`. Never store pesos as a float.
- **Theme values come from `src/lib/config/theme.ts` only.** No hex literals in components.
- **Currency displays as `₱1,234`** using `Intl.NumberFormat("en-PH")`.

---

## File Structure

**Configuration — the only files that change when the event details or theme change**
- `src/lib/config/event.ts` — event name, tagline, date, venue, price, GCash payee details, capacity
- `src/lib/config/theme.ts` — six color tokens and two font family names

**Pure logic — no I/O, fully unit tested**
- `src/lib/tickets/code.ts` — ticket code generation and display formatting
- `src/lib/tickets/reference.ts` — GCash reference normalization and validation
- `src/lib/tickets/qr.ts` — QR image rendering
- `src/lib/registrations/schema.ts` — Zod schema for the checkout form
- `src/lib/registrations/abuse.ts` — honeypot check and submission throttle

**Data access — server only**
- `src/lib/supabase/admin.ts` — service-role client
- `src/lib/supabase/server.ts` — request-scoped auth client for admin pages
- `src/lib/supabase/browser.ts` — anon client, used only for admin login
- `src/lib/supabase/types.ts` — row types
- `src/lib/registrations/queries.ts` — all registration reads and writes

**Migrations**
- `supabase/migrations/0001_init.sql`

**Routes**
- `src/app/page.tsx` — landing (skeleton here; polished in plan 3)
- `src/app/checkout/page.tsx` + `checkout-form.tsx` + `actions.ts`
- `src/app/ticket/[id]/page.tsx`
- `src/app/admin/login/page.tsx` + `login-form.tsx`
- `src/app/admin/layout.tsx` — auth gate
- `src/app/admin/review/page.tsx` + `review-card.tsx` + `actions.ts`
- `src/app/admin/registrations/page.tsx` — search, for students who lose their link
- `src/middleware.ts` — Supabase session refresh

Files that change together live together: each route folder owns its own server actions and client components.

---

## Task 1: Project scaffold, config, and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css` (via scaffold)
- Create: `src/lib/config/event.ts`
- Create: `src/lib/config/theme.ts`
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Modify: `.gitignore`
- Test: `src/lib/config/event.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `EVENT` (typed const), `formatPeso(centavos: number): string`, `THEME` (typed const)

- [ ] **Step 1: Scaffold the Next.js app in place**

`docs/` and `.gitignore` are both on `create-next-app`'s allowed-existing-files list, so this runs in the existing repo without clobbering the spec.

```powershell
cd C:\Projects\acquaintance-party
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install runtime and test dependencies**

```powershell
npm install @supabase/supabase-js @supabase/ssr zod qrcode server-only
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths @types/qrcode
```

- [ ] **Step 3: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test for event config**

Create `src/lib/config/event.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EVENT, formatPeso } from "./event";

describe("formatPeso", () => {
  it("renders centavos as whole pesos with a thousands separator", () => {
    expect(formatPeso(35000)).toBe("₱350");
    expect(formatPeso(125000)).toBe("₱1,250");
  });

  it("shows centavos only when they are non-zero", () => {
    expect(formatPeso(35050)).toBe("₱350.50");
  });

  it("renders zero without decimals", () => {
    expect(formatPeso(0)).toBe("₱0");
  });
});

describe("EVENT", () => {
  it("prices the ticket in whole centavos", () => {
    expect(Number.isInteger(EVENT.ticketPriceCentavos)).toBe(true);
    expect(EVENT.ticketPriceCentavos).toBeGreaterThan(0);
  });

  it("carries a GCash payee the student can actually pay", () => {
    expect(EVENT.gcash.name.length).toBeGreaterThan(0);
    expect(EVENT.gcash.number).toMatch(/^09\d{9}$/);
  });
});
```

- [ ] **Step 5: Run the test and confirm it fails**

```powershell
npm test -- src/lib/config/event.test.ts
```

Expected: FAIL — `Failed to resolve import "./event"`.

- [ ] **Step 6: Write the event config**

Create `src/lib/config/event.ts`. Every value here is a placeholder pending confirmation from the organisers — that is exactly why they live in one file.

```ts
/**
 * Single source of truth for event details.
 *
 * All values below are PLACEHOLDERS until the organisers confirm them.
 * Changing the event must never require touching a component.
 */
export const EVENT = {
  name: "Desert Bloom",
  tagline: "An acquaintance party",
  host: "BSIT Department",
  startsAt: new Date("2026-09-12T18:00:00+08:00"),
  venue: "University Gymnasium",
  ticketPriceCentavos: 35_000,
  capacity: 700,

  /** The GCash account students send payment to. */
  gcash: {
    name: "JUAN D. CRUZ",
    number: "09171234567",
    /** Path under /public to the payee's GCash QR screenshot. */
    qrImage: "/gcash-qr.png",
  },
} as const;

const withDecimals = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

const wholePesos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats centavos for display. Drops the decimals when they are zero. */
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const formatter = centavos % 100 === 0 ? wholePesos : withDecimals;
  return formatter.format(pesos).replace(/\u00a0/g, "");
}
```

- [ ] **Step 7: Run the test and confirm it passes**

```powershell
npm test -- src/lib/config/event.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 8: Write the theme config**

Create `src/lib/config/theme.ts`:

```ts
/**
 * The visual identity, in one place.
 *
 * The party theme is NOT finalised. Swapping it should be an edit to this
 * file, the @theme block in globals.css, and the Google Fonts link in
 * layout.tsx — nothing else. Components read these tokens through Tailwind
 * utilities and must never hardcode a hex value.
 */
export const THEME = {
  name: "Desert Sundown",
  colors: {
    accent: "#C2481F",   // burnt clay — primary actions, headlines
    accent2: "#E39824",  // sun gold — highlights, poster title
    accent3: "#7E8B5F",  // cactus sage — tertiary fills
    deep: "#3B2136",     // dusk plum — hero ground, inverted sections
    ground: "#F2E3CB",   // sand — page background
    ink: "#2E1D16",      // body text
  },
  fonts: {
    display: '"Anton", "Archivo Black", sans-serif',
    body: '"DM Sans", "Segoe UI", sans-serif',
  },
} as const;
```

- [ ] **Step 9: Expose the tokens to Tailwind**

Replace the contents of `src/app/globals.css`:

```css
@import "tailwindcss";

/* Keep in sync with src/lib/config/theme.ts.
   Tailwind v4 needs these at build time, so the values live in both places. */
@theme {
  --color-accent: #C2481F;
  --color-accent-2: #E39824;
  --color-accent-3: #7E8B5F;
  --color-deep: #3B2136;
  --color-ground: #F2E3CB;
  --color-ink: #2E1D16;

  --font-display: "Anton", "Archivo Black", sans-serif;
  --font-body: "DM Sans", "Segoe UI", sans-serif;
}

body {
  background: var(--color-ground);
  color: var(--color-ink);
  font-family: var(--font-body);
}
```

Add a matching pointer comment at the top of `theme.ts`: `// Keep in sync with the @theme block in src/app/globals.css.`

- [ ] **Step 10: Load the fonts**

In `src/app/layout.tsx`, inside `<head>`, add:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;700&display=swap"
/>
```

Set the page metadata title to `EVENT.name`.

- [ ] **Step 11: Document the environment variables**

Create `.env.local.example`:

```
# Supabase — project settings > API
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# SERVER ONLY. Never prefix with NEXT_PUBLIC_. Never import into a client component.
SUPABASE_SERVICE_ROLE_KEY=
```

Append to `.gitignore`:

```
.env.local
```

- [ ] **Step 12: Verify the app builds and commit**

```powershell
npm run build
npm test
git add -A
git commit -m "feat: scaffold Next.js app with event and theme config"
```

Expected: build succeeds, all tests pass.

---

## Task 2: Database schema and RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `docs/setup/supabase.md`

**Interfaces:**
- Consumes: nothing
- Produces: tables `registrations` and `scans`; enums `registration_status` (`pending` | `approved` | `rejected`) and `scan_result` (`ok` | `duplicate` | `invalid`); storage bucket `receipts` (private)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_init.sql`:

```sql
-- Acquaintance party ticketing: initial schema.
--
-- Access model: anonymous clients get NO policies. Every public read and
-- write goes through a Next.js server action using the service-role key,
-- which bypasses RLS. Policies below therefore only describe admin access.

create type registration_status as enum ('pending', 'approved', 'rejected');
create type scan_result as enum ('ok', 'duplicate', 'invalid');

create table registrations (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(trim(full_name)) between 2 and 120),
  year_level      text not null,
  section         text not null,
  email           text not null,
  gcash_reference text not null,
  receipt_path    text not null,
  amount          integer not null check (amount > 0),
  status          registration_status not null default 'pending',
  reject_reason   text,
  ticket_code     text unique,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users (id),

  -- An approved registration must have a ticket; a pending one must not.
  constraint ticket_code_matches_status check (
    (status = 'approved' and ticket_code is not null)
    or (status <> 'approved' and ticket_code is null)
  ),
  -- A rejection must say why, so the student can fix it and resubmit.
  constraint rejection_has_reason check (
    status <> 'rejected' or length(trim(coalesce(reject_reason, ''))) > 0
  )
);

-- The core anti-fraud lever: one GCash transaction, one ticket.
create unique index registrations_gcash_reference_key
  on registrations (gcash_reference);

create index registrations_status_created_idx
  on registrations (status, created_at desc);

create index registrations_email_idx
  on registrations (lower(email));

-- Append-only. Offline scanners sync late, so reconciliation needs the full
-- history rather than a boolean on registrations.
create table scans (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations (id) on delete cascade,
  code_scanned    text not null,
  scanned_at      timestamptz not null,
  synced_at       timestamptz not null default now(),
  device_label    text not null,
  result          scan_result not null
);

create index scans_registration_idx on scans (registration_id);
create index scans_scanned_at_idx on scans (scanned_at);

alter table registrations enable row level security;
alter table scans enable row level security;

-- Any authenticated user is an admin. Public signup MUST be disabled in the
-- Supabase dashboard (Authentication > Providers > Email > Allow new users:
-- off); admin accounts are created by hand. See docs/setup/supabase.md.
create policy "admins read registrations" on registrations
  for select to authenticated using (true);

create policy "admins update registrations" on registrations
  for update to authenticated using (true) with check (true);

create policy "admins read scans" on scans
  for select to authenticated using (true);
```

- [ ] **Step 2: Create the hosted Supabase project and link it**

This step is manual and blocks everything downstream. Do it first.

1. Create a project at https://supabase.com/dashboard (region: Southeast Asia / Singapore).
2. Copy the URL, anon key, and service-role key into `.env.local` (create it from `.env.local.example`).
3. **Authentication > Providers > Email**: turn off "Allow new users to sign up".
4. **Storage**: create a bucket named `receipts`, **Public: off**.

Then link and push:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref YOUR-PROJECT-REF
npx supabase@latest db push
```

`db push` applies migrations to the hosted database over the network. It does not need Docker.

- [ ] **Step 3: Verify the schema landed**

In the Supabase dashboard SQL editor, run:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

Expected: `registrations`, `scans`.

Then confirm the constraint actually bites:

```sql
insert into registrations (full_name, year_level, section, email,
  gcash_reference, receipt_path, amount, status, ticket_code)
values ('Test Student', '3rd year', 'B', 't@example.com',
  '1234567890123', 'x.jpg', 35000, 'approved', null);
```

Expected: ERROR — `violates check constraint "ticket_code_matches_status"`. This proves an approved registration cannot exist without a ticket. Delete any rows you created before moving on.

- [ ] **Step 4: Write the setup runbook**

Create `docs/setup/supabase.md` recording every manual step from Step 2 — project creation, the three keys, disabling public signup, the private `receipts` bucket, and the link/push commands. Someone else will need to redo this for next year's event, and dashboard clicks are invisible in git.

Include two sections:
- **Creating an admin account** — Authentication > Users > Add user, with email and password, "Auto Confirm User" checked.
- **Before launch** — a checklist of placeholder values that must be replaced: everything in `src/lib/config/event.ts`, and `public/gcash-qr.png`.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: add registrations and scans schema with RLS"
```

---

## Task 3: GCash reference validation

**Files:**
- Create: `src/lib/tickets/reference.ts`
- Test: `src/lib/tickets/reference.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeGcashReference(input: string): string`, `isValidGcashReference(input: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tickets/reference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidGcashReference, normalizeGcashReference } from "./reference";

describe("normalizeGcashReference", () => {
  it("strips the spacing students copy out of the GCash app", () => {
    expect(normalizeGcashReference("1234 5678 90123")).toBe("1234567890123");
  });

  it("strips dashes and surrounding whitespace", () => {
    expect(normalizeGcashReference("  1234-5678-90123 ")).toBe("1234567890123");
  });

  it("leaves an already-clean reference untouched", () => {
    expect(normalizeGcashReference("1234567890123")).toBe("1234567890123");
  });

  it("drops non-digits rather than throwing, so validation can report", () => {
    expect(normalizeGcashReference("Ref: 1234567890123")).toBe("1234567890123");
  });
});

describe("isValidGcashReference", () => {
  it("accepts exactly thirteen digits", () => {
    expect(isValidGcashReference("1234567890123")).toBe(true);
  });

  it("accepts thirteen digits with the app's spacing", () => {
    expect(isValidGcashReference("1234 5678 90123")).toBe(true);
  });

  it("rejects twelve digits", () => {
    expect(isValidGcashReference("123456789012")).toBe(false);
  });

  it("rejects fourteen digits", () => {
    expect(isValidGcashReference("12345678901234")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidGcashReference("")).toBe(false);
  });

  it("rejects letters", () => {
    expect(isValidGcashReference("abcdefghijklm")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/tickets/reference.test.ts
```

Expected: FAIL — `Failed to resolve import "./reference"`.

- [ ] **Step 3: Implement**

Create `src/lib/tickets/reference.ts`:

```ts
/**
 * GCash transaction reference numbers are thirteen digits. They are unique
 * per real transaction, which makes them the primary defence against a
 * student reusing a friend's receipt screenshot: the database holds a unique
 * index on the normalised value.
 *
 * This does not catch a forged screenshot carrying an invented number. That
 * is what admin review is for.
 */
const REFERENCE_DIGITS = 13;

/** Removes the spaces, dashes, and labels students paste in with the number. */
export function normalizeGcashReference(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidGcashReference(input: string): boolean {
  return normalizeGcashReference(input).length === REFERENCE_DIGITS;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```powershell
npm test -- src/lib/tickets/reference.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: validate and normalize GCash reference numbers"
```

---

## Task 4: Ticket code generation

**Files:**
- Create: `src/lib/tickets/code.ts`
- Test: `src/lib/tickets/code.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `generateTicketCode(): string` (12 chars), `formatTicketCode(code: string): string` (`XXXX-XXXX-XXXX`), `TICKET_CODE_LENGTH`, `TICKET_CODE_ALPHABET`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tickets/code.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TICKET_CODE_ALPHABET,
  TICKET_CODE_LENGTH,
  formatTicketCode,
  generateTicketCode,
} from "./code";

describe("generateTicketCode", () => {
  it("produces a code of the declared length", () => {
    expect(generateTicketCode()).toHaveLength(TICKET_CODE_LENGTH);
  });

  it("uses only alphabet characters", () => {
    const pattern = new RegExp(`^[${TICKET_CODE_ALPHABET}]+$`);
    for (let i = 0; i < 200; i++) {
      expect(generateTicketCode()).toMatch(pattern);
    }
  });

  it("excludes characters people confuse when reading a code aloud", () => {
    for (const ambiguous of ["I", "L", "O", "U"]) {
      expect(TICKET_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("does not collide across ten thousand codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateTicketCode());
    expect(seen.size).toBe(10_000);
  });

  it("does not favour any single character", () => {
    // A broken implementation — modulo bias, a stuck byte, a constant — shows
    // up as a wildly uneven distribution. With 12,000 characters over a
    // 32-symbol alphabet each should appear roughly 375 times.
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateTicketCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(TICKET_CODE_ALPHABET.length);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(150);
      expect(count).toBeLessThan(700);
    }
  });
});

describe("formatTicketCode", () => {
  it("groups the code into readable blocks of four", () => {
    expect(formatTicketCode("K4M92XQP7BTR")).toBe("K4M9-2XQP-7BTR");
  });

  it("round-trips with a generated code", () => {
    const code = generateTicketCode();
    expect(formatTicketCode(code).replace(/-/g, "")).toBe(code);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/tickets/code.test.ts
```

Expected: FAIL — `Failed to resolve import "./code"`.

- [ ] **Step 3: Implement**

Create `src/lib/tickets/code.ts`:

```ts
import { randomBytes } from "node:crypto";

/**
 * Crockford base32: the digits and uppercase letters, minus I, L, O and U.
 * Those four are dropped because a volunteer at the door will sometimes read
 * a code aloud when a camera will not focus, and I/1, L/1, O/0 are the pairs
 * that get misheard.
 */
export const TICKET_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TICKET_CODE_LENGTH = 12;

/**
 * An opaque, unguessable ticket code — 12 characters over a 32-symbol
 * alphabet is 60 bits of entropy, far beyond anything brute-forceable.
 *
 * The code carries no personal data and is not derived from the registration
 * id, so photographing someone's QR reveals nothing about them.
 */
export function generateTicketCode(): string {
  // Masking to the low 5 bits keeps the draw uniform. A plain modulo would
  // also be unbiased at exactly 32 symbols, but would silently skew if the
  // alphabet ever changed length — the mask fails loudly instead.
  const mask = 31; // 0b11111
  let out = "";

  while (out.length < TICKET_CODE_LENGTH) {
    for (const byte of randomBytes(TICKET_CODE_LENGTH)) {
      const index = byte & mask;
      if (index < TICKET_CODE_ALPHABET.length) {
        out += TICKET_CODE_ALPHABET[index];
        if (out.length === TICKET_CODE_LENGTH) break;
      }
    }
  }

  return out;
}

/** Groups a code as XXXX-XXXX-XXXX for printing and reading aloud. */
export function formatTicketCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```powershell
npm test -- src/lib/tickets/code.test.ts
```

Expected: PASS, 7 tests. The ten-thousand-code collision test takes a second or two; that is expected.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: generate opaque ticket codes"
```

---

## Task 5: Checkout form schema

**Files:**
- Create: `src/lib/registrations/schema.ts`
- Test: `src/lib/registrations/schema.test.ts`

**Interfaces:**
- Consumes: `isValidGcashReference`, `normalizeGcashReference` from `@/lib/tickets/reference`
- Produces: `checkoutSchema` (Zod), `type CheckoutInput` with fields `fullName`, `yearLevel`, `section`, `email`, `gcashReference`; `YEAR_LEVELS` (readonly tuple)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/registrations/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./schema";

const valid = {
  fullName: "Juan Miguel Dela Cruz",
  yearLevel: "3rd year",
  section: "B",
  email: "juan@example.com",
  gcashReference: "1234567890123",
};

describe("checkoutSchema", () => {
  it("accepts a complete, valid submission", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("normalizes the GCash reference so the unique index sees one form", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      gcashReference: "1234 5678 90123",
    });
    expect(parsed.gcashReference).toBe("1234567890123");
  });

  it("trims and collapses whitespace in the name", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      fullName: "  Juan   Miguel  Dela Cruz  ",
    });
    expect(parsed.fullName).toBe("Juan Miguel Dela Cruz");
  });

  it("lowercases the email so duplicates are findable", () => {
    const parsed = checkoutSchema.parse({ ...valid, email: "Juan@Example.COM" });
    expect(parsed.email).toBe("juan@example.com");
  });

  it("rejects a one-character name", () => {
    expect(checkoutSchema.safeParse({ ...valid, fullName: "J" }).success).toBe(false);
  });

  it("rejects an unknown year level", () => {
    expect(checkoutSchema.safeParse({ ...valid, yearLevel: "7th year" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(checkoutSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an empty section", () => {
    expect(checkoutSchema.safeParse({ ...valid, section: "   " }).success).toBe(false);
  });

  it("rejects a reference that is not thirteen digits", () => {
    expect(checkoutSchema.safeParse({ ...valid, gcashReference: "12345" }).success).toBe(false);
  });

  it("explains a bad reference in words a student can act on", () => {
    const result = checkoutSchema.safeParse({ ...valid, gcashReference: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/13 digits/i);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/registrations/schema.test.ts
```

Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 3: Implement**

Create `src/lib/registrations/schema.ts`:

```ts
import { z } from "zod";
import {
  isValidGcashReference,
  normalizeGcashReference,
} from "@/lib/tickets/reference";

export const YEAR_LEVELS = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
] as const;

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Enter your full name.")
        .max(120, "That name is too long."),
    ),

  yearLevel: z.enum(YEAR_LEVELS, { message: "Choose your year level." }),

  section: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, "Enter your section.")
        .max(40, "That section is too long."),
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email("Enter a valid email address.")),

  gcashReference: z
    .string()
    .refine(isValidGcashReference, "The GCash reference number is 13 digits.")
    .transform(normalizeGcashReference),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 4: Run the tests and confirm they pass**

```powershell
npm test -- src/lib/registrations/schema.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: validate checkout submissions"
```

---

## Task 6: Supabase clients and registration queries

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/registrations/queries.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `CheckoutInput` from `@/lib/registrations/schema`
- Produces:
  - `adminClient(): SupabaseClient` — service role, server only
  - `serverClient(): Promise<SupabaseClient>` — request-scoped, respects the admin's session
  - `browserClient(): SupabaseClient` — anon, login page only
  - `type Registration`, `type RegistrationStatus`, `type ScanResult`
  - `createRegistration(input: CheckoutInput & { receiptPath: string; amount: number }): Promise<CreateResult>` where `CreateResult = { ok: true; id: string } | { ok: false; error: "duplicate_reference" | "failed" }`
  - `getRegistration(id: string): Promise<Registration | null>`
  - `listPending(): Promise<Registration[]>`
  - `findByReference(reference: string): Promise<Registration[]>`
  - `signedReceiptUrl(path: string): Promise<string | null>`

- [ ] **Step 1: Define the row types**

Create `src/lib/supabase/types.ts`:

```ts
export type RegistrationStatus = "pending" | "approved" | "rejected";
export type ScanResult = "ok" | "duplicate" | "invalid";

export type Registration = {
  id: string;
  full_name: string;
  year_level: string;
  section: string;
  email: string;
  gcash_reference: string;
  receipt_path: string;
  amount: number;
  status: RegistrationStatus;
  reject_reason: string | null;
  ticket_code: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
```

- [ ] **Step 2: Write the service-role client**

Create `src/lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * The `server-only` import above makes the build fail loudly if this module is
 * ever pulled into a client bundle — which would hand the key to every
 * visitor. Do not remove it.
 */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.local.example to .env.local and fill it in.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3: Write the session-aware clients**

Create `src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Request-scoped client carrying the signed-in admin's session. */
export async function serverClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead, so this is safe.
          }
        },
      },
    },
  );
}
```

Create `src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the admin's Supabase session cookie on every /admin request. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  // The admin layout reads this to let /admin/login through its auth gate.
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 4: Write the registration queries**

Create `src/lib/registrations/queries.ts`:

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Registration } from "@/lib/supabase/types";
import type { CheckoutInput } from "./schema";

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: "duplicate_reference" | "failed" };

export async function createRegistration(
  input: CheckoutInput & { receiptPath: string; amount: number },
): Promise<CreateResult> {
  const { data, error } = await adminClient()
    .from("registrations")
    .insert({
      full_name: input.fullName,
      year_level: input.yearLevel,
      section: input.section,
      email: input.email,
      gcash_reference: input.gcashReference,
      receipt_path: input.receiptPath,
      amount: input.amount,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "duplicate_reference" };
    }
    console.error("createRegistration failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true, id: data.id };
}

export async function getRegistration(id: string): Promise<Registration | null> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as Registration) ?? null;
}

export async function listPending(): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/** Every registration sharing a GCash reference. Used to flag reused receipts. */
export async function findByReference(reference: string): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("gcash_reference", reference)
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/**
 * A short-lived URL for a receipt image. The bucket is private, so this is the
 * only way an admin sees the file, and the link dies in ten minutes.
 */
export async function signedReceiptUrl(path: string): Promise<string | null> {
  const { data } = await adminClient()
    .storage.from("receipts")
    .createSignedUrl(path, 600);

  return data?.signedUrl ?? null;
}
```

- [ ] **Step 5: Verify the build rejects a leaked service key**

Confirm the `server-only` guard works. Temporarily add `import { adminClient } from "@/lib/supabase/admin";` to the top of `src/app/checkout/checkout-form.tsx`... which does not exist yet, so instead create a throwaway `src/app/leak-test.tsx` starting with `"use client";` and that import, then run `npm run build`.

Expected: build FAILS with a `server-only` error. **Delete `src/app/leak-test.tsx`.** Verifying this guard once, now, is the whole reason it exists.

- [ ] **Step 6: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: add Supabase clients and registration queries"
```

---

## Task 7: Checkout page and server action

**Files:**
- Create: `src/app/checkout/page.tsx`
- Create: `src/app/checkout/checkout-form.tsx`
- Create: `src/app/checkout/actions.ts`
- Create: `public/gcash-qr.png`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `checkoutSchema`, `YEAR_LEVELS`, `createRegistration`, `adminClient`, `EVENT`, `formatPeso`
- Produces: `submitRegistration(prev: FormState, formData: FormData): Promise<FormState>` where `FormState = { status: "idle" | "error"; message?: string; fieldErrors?: Record<string, string> }`; redirects to `/ticket/<id>` on success

- [ ] **Step 1: Write the server action**

Create `src/app/checkout/actions.ts`:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { checkoutSchema } from "@/lib/registrations/schema";
import { createRegistration } from "@/lib/registrations/queries";
import { adminClient } from "@/lib/supabase/admin";

export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function submitRegistration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = checkoutSchema.safeParse({
    fullName: formData.get("fullName"),
    yearLevel: formData.get("yearLevel"),
    section: formData.get("section"),
    email: formData.get("email"),
    gcashReference: formData.get("gcashReference"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const receipt = formData.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return {
      status: "error",
      message: "Attach a screenshot of your GCash receipt.",
      fieldErrors: { receipt: "Attach your receipt screenshot." },
    };
  }
  if (receipt.size > MAX_RECEIPT_BYTES) {
    return {
      status: "error",
      message: "That image is over 5 MB. Try a screenshot instead of a photo.",
      fieldErrors: { receipt: "Keep the image under 5 MB." },
    };
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
    return {
      status: "error",
      message: "Upload a JPG, PNG, or WebP image.",
      fieldErrors: { receipt: "Use a JPG, PNG, or WebP image." },
    };
  }

  const extension = receipt.type.split("/")[1].replace("jpeg", "jpg");
  const receiptPath = `${new Date().getFullYear()}/${randomUUID()}.${extension}`;

  const upload = await adminClient()
    .storage.from("receipts")
    .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false });

  if (upload.error) {
    console.error("receipt upload failed", upload.error);
    return {
      status: "error",
      message: "We could not save your receipt. Try again in a moment.",
    };
  }

  const created = await createRegistration({
    ...parsed.data,
    receiptPath,
    amount: EVENT.ticketPriceCentavos,
  });

  if (!created.ok) {
    // The receipt is now orphaned in storage. Remove it so a retry is clean.
    await adminClient().storage.from("receipts").remove([receiptPath]);

    if (created.error === "duplicate_reference") {
      return {
        status: "error",
        message:
          "That GCash reference number has already been used for another ticket. " +
          "Check that you copied the number from your own receipt.",
        fieldErrors: { gcashReference: "Already used for another ticket." },
      };
    }
    return {
      status: "error",
      message: "Something went wrong saving your ticket. Try again in a moment.",
    };
  }

  redirect(`/ticket/${created.id}`);
}
```

- [ ] **Step 2: Write the client form**

Create `src/app/checkout/checkout-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { submitRegistration, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

export function CheckoutForm() {
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.message ? (
        <p role="alert" className="rounded bg-accent/10 px-4 py-3 text-accent">
          {state.message}
        </p>
      ) : null}

      <Field label="Full name" name="fullName" error={errors.fullName}>
        <input
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
          className="w-full rounded border border-ink/25 bg-white px-3 py-2"
        />
      </Field>

      <Field label="Year level" name="yearLevel" error={errors.yearLevel}>
        <select
          id="yearLevel"
          name="yearLevel"
          required
          defaultValue=""
          className="w-full rounded border border-ink/25 bg-white px-3 py-2"
        >
          <option value="" disabled>
            Select your year level
          </option>
          {YEAR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Section" name="section" error={errors.section}>
        <input
          id="section"
          name="section"
          required
          className="w-full rounded border border-ink/25 bg-white px-3 py-2"
        />
      </Field>

      <Field
        label="Personal email"
        name="email"
        hint="Your ticket is tied to this address, so we can find it if you lose the link."
        error={errors.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-ink/25 bg-white px-3 py-2"
        />
      </Field>

      <Field
        label="GCash reference number"
        name="gcashReference"
        hint="The 13-digit number on your GCash receipt."
        error={errors.gcashReference}
      >
        <input
          id="gcashReference"
          name="gcashReference"
          required
          inputMode="numeric"
          className="w-full rounded border border-ink/25 bg-white px-3 py-2 font-mono"
        />
      </Field>

      <Field
        label="Receipt screenshot"
        name="receipt"
        hint="JPG, PNG, or WebP, under 5 MB."
        error={errors.receipt}
      >
        <input
          id="receipt"
          name="receipt"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
          className="w-full text-sm"
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-6 py-3 font-semibold uppercase tracking-wide text-ground disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-semibold">
        {label}
      </label>
      {hint ? <p className="text-sm text-ink/65">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-medium text-accent">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Write the checkout page**

Create `src/app/checkout/page.tsx`. Payment instructions come *before* the form, because the student must pay first to have a reference number to enter.

```tsx
import Image from "next/image";
import { EVENT, formatPeso } from "@/lib/config/event";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: `Get your ticket · ${EVENT.name}` };

export default function CheckoutPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
      <section>
        <h1 className="font-display text-4xl uppercase">Pay first</h1>
        <p className="mt-3 max-w-prose">
          Send {formatPeso(EVENT.ticketPriceCentavos)} through GCash, then come
          back and fill in the form with your receipt. We check every payment by
          hand, so your ticket appears once it is approved.
        </p>

        <dl className="mt-6 rounded border border-ink/20 bg-white/60 p-5">
          <dt className="text-sm uppercase tracking-wide text-ink/60">Send to</dt>
          <dd className="font-display text-2xl">{EVENT.gcash.name}</dd>
          <dd className="font-mono text-lg">{EVENT.gcash.number}</dd>
          <dt className="mt-4 text-sm uppercase tracking-wide text-ink/60">Amount</dt>
          <dd className="font-display text-2xl">
            {formatPeso(EVENT.ticketPriceCentavos)}
          </dd>
        </dl>

        <Image
          src={EVENT.gcash.qrImage}
          alt={`GCash QR code for ${EVENT.gcash.name}`}
          width={240}
          height={240}
          className="mt-6 rounded bg-white p-3"
        />
      </section>

      <section>
        <h2 className="font-display text-4xl uppercase">Your details</h2>
        <p className="mt-3 mb-6 max-w-prose">
          Use your own name and email — this is what we check at the door.
        </p>
        <CheckoutForm />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add a placeholder GCash QR image**

Save any 240x240 PNG as `public/gcash-qr.png`. Replacing it with the real payee QR is already on the "Before launch" checklist in `docs/setup/supabase.md` from Task 2.

- [ ] **Step 5: Point the landing page at checkout**

Replace `src/app/page.tsx`. Plan 3 replaces this with the designed version — keep it plain, do not invest here.

```tsx
import Link from "next/link";
import { EVENT, formatPeso } from "@/lib/config/event";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-5">
      <p className="text-sm uppercase tracking-[0.2em] text-ink/60">
        {EVENT.host} presents
      </p>
      <h1 className="font-display text-6xl uppercase leading-none md:text-8xl">
        {EVENT.name}
      </h1>
      <p className="text-lg">
        {EVENT.startsAt.toLocaleDateString("en-PH", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}{" "}
        · {EVENT.venue}
      </p>
      <Link
        href="/checkout"
        className="self-start rounded bg-accent px-7 py-4 font-semibold uppercase tracking-wide text-ground"
      >
        Get your ticket — {formatPeso(EVENT.ticketPriceCentavos)}
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Verify by hand**

```powershell
npm run dev
```

Against `http://localhost:3000/checkout`, confirm each stated result:

1. Submit an empty form → each required field is flagged, nothing is written.
2. Enter a 12-digit reference → "The GCash reference number is 13 digits."
3. Upload a `.pdf` → "Use a JPG, PNG, or WebP image."
4. Submit a valid form → redirected to `/ticket/<uuid>` (a 404 for now; Task 9 builds it).
5. In the Supabase dashboard, confirm one `registrations` row with `status = 'pending'` and `ticket_code = null`, and one object in the `receipts` bucket.
6. Submit again with the **same** reference number → the duplicate message appears, **no second row is written**, and **no orphaned object** is left in the bucket.

Check 6 matters most: it proves both the unique index and the orphan cleanup.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: add checkout with receipt upload and duplicate detection"
```

---

## Task 8: Admin login and review queue

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/login-form.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/review/page.tsx`
- Create: `src/app/admin/review/review-card.tsx`
- Create: `src/app/admin/review/actions.ts`

**Interfaces:**
- Consumes: `listPending`, `findByReference`, `signedReceiptUrl`, `generateTicketCode`, `serverClient`, `adminClient`, `formatPeso`, `Registration`
- Produces: `approveRegistration(id: string): Promise<ActionResult>`, `rejectRegistration(id: string, reason: string): Promise<ActionResult>` where `ActionResult = { ok: boolean; error?: string }`

- [ ] **Step 1: Write the login form**

Create `src/app/admin/login/login-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await browserClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (result.error) {
      setError("That email and password do not match an admin account.");
      setPending(false);
      return;
    }

    router.push("/admin/review");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {error ? (
        <p role="alert" className="rounded bg-accent/10 px-4 py-3 text-accent">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-ink/25 bg-white px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-ink/25 bg-white px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-6 py-3 font-semibold text-ground disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

Create `src/app/admin/login/page.tsx`:

```tsx
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-5">
      <h1 className="font-display text-3xl uppercase">Admin sign in</h1>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 2: Gate every other admin route**

Create `src/app/admin/layout.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The login page lives under /admin but must stay reachable while signed out.
  // `x-pathname` is set by src/middleware.ts.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.endsWith("/admin/login")) return <>{children}</>;

  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");

  return <>{children}</>;
}
```

- [ ] **Step 3: Write the review actions**

Create `src/app/admin/review/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { generateTicketCode } from "@/lib/tickets/code";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

export type ActionResult = { ok: boolean; error?: string };

async function currentAdminId(): Promise<string | null> {
  const { data } = await (await serverClient()).auth.getUser();
  return data.user?.id ?? null;
}

export async function approveRegistration(id: string): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  // Retry on the vanishingly unlikely ticket-code collision rather than
  // failing the approval. The unique index is what makes this safe.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await adminClient()
      .from("registrations")
      .update({
        status: "approved",
        ticket_code: generateTicketCode(),
        reject_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq("id", id)
      .eq("status", "pending"); // no-op if another admin already handled it

    if (!error) {
      revalidatePath("/admin/review");
      return { ok: true };
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("approve failed", error);
      return { ok: false, error: "Could not approve. Try again." };
    }
  }

  return { ok: false, error: "Could not generate a ticket code. Try again." };
}

export async function rejectRegistration(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Give a reason the student can act on." };

  const { error } = await adminClient()
    .from("registrations")
    .update({
      status: "rejected",
      reject_reason: trimmed,
      ticket_code: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("reject failed", error);
    return { ok: false, error: "Could not reject. Try again." };
  }

  revalidatePath("/admin/review");
  return { ok: true };
}
```

- [ ] **Step 4: Write the review card**

Create `src/app/admin/review/review-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import {
  approveRegistration,
  rejectRegistration,
  type ActionResult,
} from "./actions";

export function ReviewCard({
  registration,
  receiptUrl,
  duplicateCount,
}: {
  registration: Registration;
  receiptUrl: string | null;
  duplicateCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <article className="grid gap-5 rounded border border-ink/20 bg-white p-5 md:grid-cols-[280px_1fr]">
      {receiptUrl ? (
        <a href={receiptUrl} target="_blank" rel="noreferrer">
          {/* Signed Supabase URL, not a configured next/image host — plain img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt={`Receipt submitted by ${registration.full_name}`}
            className="w-full rounded border border-ink/15"
          />
        </a>
      ) : (
        <p className="text-sm text-ink/60">Receipt image unavailable.</p>
      )}

      <div className="flex flex-col gap-3">
        {duplicateCount > 1 ? (
          <p className="rounded bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
            This reference number appears on {duplicateCount} registrations.
            Check the GCash transaction history before approving.
          </p>
        ) : null}

        <div>
          <h2 className="text-xl font-bold">{registration.full_name}</h2>
          <p className="text-ink/70">
            {registration.year_level} · Section {registration.section}
          </p>
          <p className="text-ink/70">{registration.email}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-ink/60">Reference</dt>
          <dd className="font-mono">{registration.gcash_reference}</dd>
          <dt className="text-ink/60">Amount</dt>
          <dd>{formatPeso(registration.amount)}</dd>
          <dt className="text-ink/60">Submitted</dt>
          <dd>{new Date(registration.created_at).toLocaleString("en-PH")}</dd>
        </dl>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveRegistration(registration.id))}
            className="rounded bg-green-800 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Approve
          </button>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for rejecting"
            aria-label="Reason for rejecting"
            className="min-w-52 flex-1 rounded border border-ink/25 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => rejectRegistration(registration.id, reason))}
            className="rounded border border-red-800 px-5 py-2.5 font-semibold text-red-800 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Write the review page**

Create `src/app/admin/review/page.tsx`:

```tsx
import {
  findByReference,
  listPending,
  signedReceiptUrl,
} from "@/lib/registrations/queries";
import { ReviewCard } from "./review-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const pending = await listPending();

  const cards = await Promise.all(
    pending.map(async (registration) => ({
      registration,
      receiptUrl: await signedReceiptUrl(registration.receipt_path),
      duplicateCount: (await findByReference(registration.gcash_reference)).length,
    })),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="font-display text-3xl uppercase">Review queue</h1>
        <p className="text-ink/70">
          {pending.length === 0
            ? "Nothing waiting. Every payment has been reviewed."
            : `${pending.length} waiting for review.`}
        </p>
      </header>

      {cards.map((card) => (
        <ReviewCard key={card.registration.id} {...card} />
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Verify by hand**

Create an admin account first (Supabase dashboard → Authentication → Users → Add user, "Auto Confirm User" checked).

1. Visit `/admin/review` while signed out → redirected to `/admin/login`.
2. Sign in with a wrong password → "That email and password do not match an admin account."
3. Sign in correctly → the review queue lists the registration from Task 7, with the receipt image visible.
4. Confirm the duplicate banner. In the SQL editor, point two pending rows at the same reference:
   `update registrations set gcash_reference = '1111111111111' where id in ('<id-a>', '<id-b>');`
   Reload the queue → both cards show the red banner naming a count of 2. Restore distinct references afterwards.
5. Approve one → it leaves the queue; in the dashboard `status = 'approved'` with a non-null 12-character `ticket_code`.
6. Reject one with a reason → it leaves the queue; `status = 'rejected'`, `reject_reason` set, `ticket_code` still null.
7. Try rejecting with an empty reason → the button stays disabled.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: add admin login and review queue"
```

---

## Task 9: Ticket page with QR

**Files:**
- Create: `src/lib/tickets/qr.ts`
- Create: `src/app/ticket/[id]/page.tsx`
- Test: `src/lib/tickets/qr.test.ts`

**Interfaces:**
- Consumes: `getRegistration`, `formatTicketCode`, `EVENT`
- Produces: `ticketQrDataUrl(code: string): Promise<string>` — a `data:image/png;base64,…` URL for an `<img src>`

- [ ] **Step 1: Write the failing QR tests**

Create `src/lib/tickets/qr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ticketQrDataUrl } from "./qr";

describe("ticketQrDataUrl", () => {
  it("returns a PNG data URL that an img tag can render", async () => {
    const url = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("is deterministic, so the same ticket always looks the same", async () => {
    const a = await ticketQrDataUrl("K4M92XQP7BTR");
    const b = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(a).toBe(b);
  });

  it("encodes different codes as different images", async () => {
    const a = await ticketQrDataUrl("K4M92XQP7BTR");
    const b = await ticketQrDataUrl("ZZZZ1111ZZZZ");
    expect(a).not.toBe(b);
  });

  it("renders large enough to scan from a phone screen", async () => {
    // A 512px QR is several kilobytes of base64. A few hundred bytes would
    // mean the image came out too small to focus on at the door.
    const url = await ticketQrDataUrl("K4M92XQP7BTR");
    expect(url.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/tickets/qr.test.ts
```

Expected: FAIL — `Failed to resolve import "./qr"`.

- [ ] **Step 3: Implement**

Create `src/lib/tickets/qr.ts`:

```ts
import QRCode from "qrcode";

/**
 * Renders a ticket code as a PNG data URL for an <img> tag.
 *
 * Pure black on pure white with a four-module quiet zone is not a style
 * choice — phone cameras fail on codes drawn over tinted or textured grounds,
 * and the door is the worst possible place to discover that.
 *
 * Error-correction level M tolerates a scuffed or dimmed phone screen without
 * inflating the module count the way H would.
 *
 * A data URL rather than inline SVG: it needs no raw HTML injection, so there
 * is no `dangerouslySetInnerHTML` anywhere in this project.
 */
export async function ticketQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```powershell
npm test -- src/lib/tickets/qr.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the ticket page**

Create `src/app/ticket/[id]/page.tsx`. It handles all three statuses — this single page is the student's only view of their purchase.

```tsx
import { notFound } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { getRegistration } from "@/lib/registrations/queries";
import { formatTicketCode } from "@/lib/tickets/code";
import { ticketQrDataUrl } from "@/lib/tickets/qr";

export const dynamic = "force-dynamic";
export const metadata = { title: `Your ticket · ${EVENT.name}` };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registration = await getRegistration(id);
  if (!registration) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 bg-accent px-5 py-4 text-ground">
          <span className="font-display text-2xl uppercase leading-none">
            {EVENT.name}
          </span>
          <span className="text-right text-[10px] uppercase tracking-widest">
            Admit one
            <br />
            {EVENT.startsAt.toLocaleDateString("en-PH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </header>

        {registration.status === "approved" && registration.ticket_code ? (
          <ApprovedTicket code={registration.ticket_code} />
        ) : registration.status === "rejected" ? (
          <Rejected reason={registration.reject_reason} />
        ) : (
          <Pending />
        )}

        <div className="px-5 pb-5">
          <p className="text-lg font-bold">{registration.full_name}</p>
          <p className="text-sm uppercase tracking-wide text-ink/60">
            {registration.year_level} · Section {registration.section}
          </p>
        </div>
      </div>

      <p className="text-center text-sm text-ink/70">
        Bookmark this page — it is your ticket. Lost it? Ask an organiser to
        look you up by your email address.
      </p>
    </main>
  );
}

async function ApprovedTicket({ code }: { code: string }) {
  const qr = await ticketQrDataUrl(code);
  return (
    // The QR must sit on plain white. Do not theme this block.
    <div className="m-5 flex flex-col items-center gap-3 rounded bg-white p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Your ticket QR code" width={160} height={160} />
      <p className="font-mono text-sm tracking-widest text-ink/70">
        {formatTicketCode(code)}
      </p>
    </div>
  );
}

function Pending() {
  return (
    <div className="m-5 rounded bg-amber-50 p-5 text-center">
      <p className="font-display text-2xl uppercase text-amber-900">
        Waiting for approval
      </p>
      <p className="mt-2 text-sm text-amber-900/80">
        We are checking your payment by hand. Come back to this page later and
        your QR code will be here.
      </p>
    </div>
  );
}

function Rejected({ reason }: { reason: string | null }) {
  return (
    <div className="m-5 rounded bg-red-50 p-5 text-center">
      <p className="font-display text-2xl uppercase text-red-900">
        We could not approve this
      </p>
      <p className="mt-2 text-sm text-red-900/80">
        {reason ?? "Contact an organiser for help."}
      </p>
      <a href="/checkout" className="mt-3 inline-block font-semibold underline">
        Submit again
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Verify by hand**

1. Visit `/ticket/<pending-id>` → "Waiting for approval", no QR.
2. Visit `/ticket/<rejected-id>` → the rejection reason and a "Submit again" link.
3. Visit `/ticket/<approved-id>` → a QR on a white card with the formatted code beneath.
4. **Scan the QR with a phone camera.** It must decode to the bare 12-character code — no URL, no JSON, no punctuation. This is the single most important check in the plan; everything at the door depends on it.
5. Visit `/ticket/00000000-0000-0000-0000-000000000000` → 404.

- [ ] **Step 7: Run the full suite, build, and commit**

```powershell
npm test
npm run build
git add -A
git commit -m "feat: add ticket page with QR code"
```

Expected: all tests pass, build succeeds.

---

## Task 10: Honeypot and submission throttle

The spec lists rate limiting and a honeypot as secondary fraud measures
alongside the unique reference index. Without them, one script can fill the
review queue with hundreds of junk rows the night before the event, and the
real submissions get buried.

There is no Redis or KV store in this stack, and adding one for this is not
worth the dependency. The throttle counts recent rows for the same email in
Postgres instead — good enough to stop casual abuse, and it costs one query.

**Files:**
- Create: `src/lib/registrations/abuse.ts`
- Test: `src/lib/registrations/abuse.test.ts`
- Modify: `src/lib/registrations/queries.ts`
- Modify: `src/app/checkout/actions.ts`
- Modify: `src/app/checkout/checkout-form.tsx`

**Interfaces:**
- Consumes: `adminClient`
- Produces:
  - `HONEYPOT_FIELD` (string constant `"nickname"`)
  - `isHoneypotTripped(value: unknown): boolean`
  - `throttleWindowStart(now: Date): string` — ISO timestamp
  - `isThrottled(recentCount: number): boolean`
  - `THROTTLE_WINDOW_MINUTES`, `THROTTLE_MAX_SUBMISSIONS`
  - `countRecentByEmail(email: string, sinceIso: string): Promise<number>` in `queries.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/registrations/abuse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  THROTTLE_MAX_SUBMISSIONS,
  THROTTLE_WINDOW_MINUTES,
  isHoneypotTripped,
  isThrottled,
  throttleWindowStart,
} from "./abuse";

describe("isHoneypotTripped", () => {
  it("passes when a real person leaves the hidden field alone", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  it("passes when the field is whitespace a browser autofilled", () => {
    expect(isHoneypotTripped("   ")).toBe(false);
  });

  it("trips when a bot fills the hidden field", () => {
    expect(isHoneypotTripped("Juan")).toBe(true);
  });

  it("trips on a non-string value rather than ignoring it", () => {
    expect(isHoneypotTripped(42)).toBe(true);
  });
});

describe("throttleWindowStart", () => {
  it("looks back exactly the configured window", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    const start = new Date(throttleWindowStart(now));
    const minutesBack = (now.getTime() - start.getTime()) / 60_000;
    expect(minutesBack).toBe(THROTTLE_WINDOW_MINUTES);
  });

  it("returns an ISO string Postgres can compare", () => {
    const start = throttleWindowStart(new Date("2026-09-01T12:00:00.000Z"));
    expect(start).toBe("2026-09-01T11:45:00.000Z");
  });
});

describe("isThrottled", () => {
  it("allows a first submission", () => {
    expect(isThrottled(0)).toBe(false);
  });

  it("allows submissions up to the limit, since retries are legitimate", () => {
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS - 1)).toBe(false);
  });

  it("blocks once the limit is reached", () => {
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS)).toBe(true);
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS + 10)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/registrations/abuse.test.ts
```

Expected: FAIL — `Failed to resolve import "./abuse"`.

- [ ] **Step 3: Implement**

Create `src/lib/registrations/abuse.ts`:

```ts
/**
 * Cheap defences against someone flooding the review queue.
 *
 * Neither of these stops a determined attacker. They stop a script and a bored
 * student, which is the realistic threat for a school event, and they cost one
 * hidden input and one indexed query.
 */

/**
 * A field no human sees. Bots fill every input they find, so any value here
 * means the submission was not typed by a person. Named "nickname" rather than
 * "honeypot" so it is not obvious from the page source.
 */
export const HONEYPOT_FIELD = "nickname";

export const THROTTLE_WINDOW_MINUTES = 15;

/**
 * Three attempts per email per window. A real student legitimately retries —
 * wrong reference number, bad photo, a failed upload — so the limit has to sit
 * above normal frustration, not at it.
 */
export const THROTTLE_MAX_SUBMISSIONS = 3;

export function isHoneypotTripped(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return true;
  return value.trim().length > 0;
}

/** The earliest timestamp still inside the throttle window. */
export function throttleWindowStart(now: Date): string {
  return new Date(now.getTime() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
}

export function isThrottled(recentCount: number): boolean {
  return recentCount >= THROTTLE_MAX_SUBMISSIONS;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```powershell
npm test -- src/lib/registrations/abuse.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Add the counting query**

Append to `src/lib/registrations/queries.ts`:

```ts
/** How many times this email has submitted since `sinceIso`. */
export async function countRecentByEmail(
  email: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", sinceIso);

  return count ?? 0;
}
```

- [ ] **Step 6: Wire both checks into the server action**

In `src/app/checkout/actions.ts`, extend the imports:

```ts
import {
  HONEYPOT_FIELD,
  isHoneypotTripped,
  isThrottled,
  throttleWindowStart,
} from "@/lib/registrations/abuse";
import {
  countRecentByEmail,
  createRegistration,
} from "@/lib/registrations/queries";
```

Then insert this block **immediately after** the `if (!parsed.success)` branch and **before** the receipt checks — rejecting a bot before uploading its file:

```ts
  // A bot filled the hidden field. Report success so it does not learn why,
  // but write nothing.
  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { status: "idle" };
  }

  const recent = await countRecentByEmail(
    parsed.data.email,
    throttleWindowStart(new Date()),
  );
  if (isThrottled(recent)) {
    return {
      status: "error",
      message:
        "You have submitted several times in the last few minutes. " +
        "Wait a moment before trying again, or message an organiser for help.",
    };
  }
```

- [ ] **Step 7: Add the hidden field to the form**

In `src/app/checkout/checkout-form.tsx`, import the constant:

```tsx
import { HONEYPOT_FIELD } from "@/lib/registrations/abuse";
```

and add this as the **first** child of `<form>`:

```tsx
{/* Hidden from people, irresistible to bots. Not display:none — some bots
    skip those. Off-screen with no tab stop and no label association. */}
<div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 overflow-hidden">
  <input
    type="text"
    name={HONEYPOT_FIELD}
    tabIndex={-1}
    autoComplete="off"
  />
</div>
```

Add `relative` to the `<form>` element's className so the absolute positioning is contained.

- [ ] **Step 8: Verify by hand**

1. Submit the form normally → still works, still redirects to the ticket page.
2. In devtools, set the hidden `nickname` input's value to `bot` and submit → the page returns to idle with **no new row** in the database and **no new object** in storage.
3. Submit four times in a row with the same email and different reference numbers → the fourth is refused with the throttle message, and no fourth row appears.

Check 2 is the one worth doing carefully: a honeypot that still writes the row is worse than no honeypot, because it looks like it is working.

- [ ] **Step 9: Commit**

```powershell
npm test
git add -A
git commit -m "feat: add honeypot and submission throttle to checkout"
```

---

## Task 11: Registration search for lost tickets

The ticket page tells students "ask an organiser to look you up by your email
address." Right now no such screen exists, so that sentence is a lie. At 600
attendees this is a primary support path, not an edge case — expect dozens of
lost links, most of them in the queue at the door.

**Files:**
- Create: `src/app/admin/registrations/page.tsx`
- Modify: `src/lib/registrations/queries.ts`
- Modify: `src/app/admin/review/page.tsx`

**Interfaces:**
- Consumes: `adminClient`, `Registration`, `formatTicketCode`, `formatPeso`
- Produces: `searchRegistrations(query: string): Promise<Registration[]>` in `queries.ts`

- [ ] **Step 1: Add the search query**

Append to `src/lib/registrations/queries.ts`:

```ts
/**
 * Finds registrations by partial name or email, for a student at the door who
 * has lost their ticket link. Capped at 50 so a one-letter search cannot drag
 * the whole table down mid-event.
 */
export async function searchRegistrations(query: string): Promise<Registration[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Escape PostgREST's pattern wildcards and its comma/parenthesis separators
  // so a search for "a,b" cannot break out of the filter expression.
  const safe = trimmed.replace(/[%_,()\\]/g, "");
  if (!safe) return [];

  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data as Registration[]) ?? [];
}
```

- [ ] **Step 2: Write the search page**

Create `src/app/admin/registrations/page.tsx`. It is a plain GET form, so a
result page can be bookmarked and reloaded — useful when a volunteer's phone
drops the connection mid-lookup.

```tsx
import Link from "next/link";
import { formatPeso } from "@/lib/config/event";
import { searchRegistrations } from "@/lib/registrations/queries";
import { formatTicketCode } from "@/lib/tickets/code";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a registration" };

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-900",
  pending: "bg-amber-100 text-amber-900",
  rejected: "bg-red-100 text-red-900",
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchRegistrations(q);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="font-display text-3xl uppercase">Find a registration</h1>
        <p className="text-ink/70">
          Search by name or email when a student has lost their ticket link.
        </p>
      </header>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          aria-label="Search by name or email"
          className="flex-1 rounded border border-ink/25 bg-white px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-accent px-5 py-2.5 font-semibold text-ground"
        >
          Search
        </button>
      </form>

      {q.trim().length >= 2 && results.length === 0 ? (
        <p className="text-ink/70">
          Nothing matches “{q}”. Try just the surname, or the email they paid
          with.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {results.map((registration) => (
          <li
            key={registration.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-ink/20 bg-white p-4"
          >
            <div>
              <p className="font-bold">{registration.full_name}</p>
              <p className="text-sm text-ink/70">
                {registration.year_level} · Section {registration.section} ·{" "}
                {registration.email}
              </p>
              <p className="text-sm text-ink/60">
                {formatPeso(registration.amount)} · ref{" "}
                <span className="font-mono">{registration.gcash_reference}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                  STATUS_STYLES[registration.status]
                }`}
              >
                {registration.status}
              </span>
              {registration.ticket_code ? (
                <span className="font-mono text-sm">
                  {formatTicketCode(registration.ticket_code)}
                </span>
              ) : null}
              <Link
                href={`/ticket/${registration.id}`}
                className="font-semibold underline"
              >
                Open ticket
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Link the two admin pages together**

In `src/app/admin/review/page.tsx`, add a nav line inside `<header>`, beneath the existing `<p>`:

```tsx
<Link href="/admin/registrations" className="text-sm font-semibold underline">
  Find a registration
</Link>
```

Add `import Link from "next/link";` at the top of that file.

- [ ] **Step 4: Verify by hand**

1. Visit `/admin/registrations` signed out → redirected to `/admin/login`.
2. Search a single letter → no results, no error (the two-character floor).
3. Search a partial surname → the matching student appears with the right status pill.
4. Search a partial email in a different case → the same student appears.
5. Search `%` → no results and no crash. This is the injection check; do not skip it.
6. Click "Open ticket" on an approved student → their QR, ready to show at the door.

- [ ] **Step 5: Commit**

```powershell
npm test
npm run build
git add -A
git commit -m "feat: add admin search for lost ticket links"
```

---

## Definition of done

This plan is complete when all of the following hold:

- A student can pay, submit their details and receipt, and land on a permanent ticket link.
- A reused GCash reference number is rejected at submission and leaves no orphaned file in storage.
- An admin can sign in, see the receipt image beside the entered reference, and approve or reject with a reason.
- A duplicate reference raises a visible warning on every registration sharing it.
- An approved student's page shows a QR that a phone camera decodes to their ticket code.
- A bot filling the honeypot writes nothing, and a fourth submission from one email inside fifteen minutes is refused.
- An admin can find a student by partial name or email and open their ticket — the support path the ticket page promises.
- `npm test` and `npm run build` both pass.

**Not yet built:** scanning, attendance, exports, Sheets sync, the designed landing page, and the raffle. Those are plans 2 and 3.

## Deploy checkpoint

Before starting plan 2, deploy to Vercel. HTTPS is required for the scanner's camera access in plan 2, and discovering a deploy problem then would be expensive.

```powershell
npx vercel@latest
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project's environment variables. Confirm the deployed checkout writes to the same Supabase project, then commit any config changes.
