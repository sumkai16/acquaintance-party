# Launch and Raffle Implementation Plan

**Goal:** finish the three items plans 1 and 2 deliberately left: a landing
page a student trusts enough to pay through, a raffle that can be run in front
of 600 people without anyone questioning the result, and a live attendance
Sheet the organisers can leave open.

**Plan 3 of 3.** Plans 1 (`2026-08-30-sell-and-verify.md`) and 2
(`2026-08-31-door-operations.md`) are complete and verified by hand. Nothing
here is load-bearing at the door — that was the point of building it last.

**Spec:** `docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md`
§Raffle, §Attendance record, §Visual design

**Tech Stack:** existing (Next 16, TypeScript, Tailwind v4, Supabase, Zod,
Vitest). No new dependency — the raffle animates on CSS transitions and
`requestAnimationFrame`, and the Sheets client is a service-account JWT signed
with `node:crypto` rather than the very large `googleapis` package.

## Build order, and why it is not the spec's

The spec ordered these Sheets → landing → raffle. That order assumed under two
weeks of runway, where the last item was the cut candidate. The real gap to
2026-10-05 is about five weeks, so the order was changed to **landing → raffle
→ Sheets**:

- The landing page is the only item that affects anyone before event day —
  students read it while deciding to pay.
- The raffle is the largest piece and the one with an audience, so it wants
  the most testing buffer.
- Sheets sync is last because the dashboard already shows live attendance and
  `.xlsx` export already preserves the record. It is the only item whose loss
  costs nothing but convenience.

## Global Constraints

Plans 1 and 2's constraints still hold. In addition:

- **The party theme is still unconfirmed.** The landing hero stays
  structurally theme-neutral — eyebrow, title, date, call to action — with the
  festival feel coming from type and color only. A confirmed theme must stay a
  token edit, not a rebuild. No component may carry a hex value or font name.
- **The raffle draw is server-side, always.** One request settles finalists
  and winner before anything animates. There is no client-side fallback, even
  offline: a draw the browser decided is riggable from devtools, and a prize
  draw has to survive being questioned.
- **The Sheet must never affect the door.** Postgres is the record. Every
  Sheets failure is a log line, exactly as the Discord webhook already
  behaves.
- **Prizes are config, not a table.** `RAFFLE_PRIZES` in
  `src/lib/config/event.ts`. This drops the spec's `prizes` table: a list that
  changes twice does not need a schema and a CRUD screen.

## Task 1: Landing page — done

Rebuilt `src/app/page.tsx` as a hero on `bg-deep` (the inverted section the
palette was designed for and nothing had ever used) plus three sections: what
the ticket includes, the three-step buying flow, and an FAQ. Inclusions and FAQ
copy moved into `EVENT` config so the committee can edit them without touching
a component.

Reuses checkout's existing card, button and focus-state patterns rather than
inventing new ones.

**Verified by hand:** rendered at 390px and desktop; FAQ opens, closes and
takes focus by keyboard alone with a visible ring; CTA reaches `/checkout` with
the price from config.

## Task 2: Raffle — done, not yet rehearsed

- `supabase/migrations/0002_raffle.sql` — `raffle_draws`, with `finalists`
  snapshotting each shortlisted student rather than storing bare ids, so a past
  draw redisplays with no join and a later name correction never rewrites what
  was announced.
- `src/lib/raffle/draw.ts` (+ tests) — partial Fisher-Yates over `node:crypto`,
  RNG injected so tests can make a draw deterministic. 15 tests.
- `src/lib/raffle/queries.ts` — eligible pool reusing `approvedManifest()`, so
  "checked in" keeps exactly one definition in the codebase.
- `src/app/admin/raffle/` — one screen, operated from the laptop driving the
  projector. Controls between prizes, hidden while animating.

Two guards the spec left open, both decided here:

1. Drawing a prize that already has a live winner is refused and points at
   Redraw. A second fresh row would read as an untagged rerun — the thing
   `supersedes` exists to prevent.
2. A redraw always excludes prior winners of that same prize, whatever the
   toggle says. Redrawing a no-show and handing it straight back is absurd on
   stage.

**Verified so far:** the wheel's landing angle was measured in the browser, not
eyeballed — the winner's slice centre stops within a few degrees of the
pointer. Both animation stages render correctly on the Night Set palette.

**Not yet verified — do before the event:**

- [ ] Paste `0002_raffle.sql` into the hosted project. `/admin/raffle` errors
      until this is done. See `docs/setup/supabase.md` §6.
- [ ] Draw with real checked-in rows; confirm the winner on screen matches the
      `raffle_draws` row.
- [ ] Draw the same prize twice — the second must be refused.
- [ ] Redraw; confirm `is_redraw` and `supersedes` are set and both rows
      survive, and that the no-show cannot win their own redraw.
- [ ] Draw with an empty pool — a readable message, not a crash.
- [ ] Go offline mid-spin after the response lands; the animation must finish.
- [ ] Read it from the back of a room on the actual projector.

## Task 3: Google Sheets sync — done, needs credentials

- `src/lib/sheets/row.ts` (+ tests) — pure, one scan as a row of cells, both
  clocks in Manila time.
- `src/lib/sheets/sheets.ts` — `server-only`, signs a service-account JWT with
  `node:crypto`, appends, never throws.
- `POST /api/scan/sync` publishes inside `after()`.

The subtle part is idempotency. The scanner retries queued batches blindly and
the upsert ignores duplicates, so appending from the request body would list
the same student once per retry. `recordScans` now returns only the rows
`on conflict do nothing` actually inserted, and the append keys off those.

**Not yet verified — do before the event:**

- [ ] Follow `docs/setup/google-sheets.md`: service account, share the Sheet,
      three env vars in Vercel, redeploy.
- [ ] Scan and watch a row appear.
- [ ] Scan offline, restore the connection, confirm **exactly one** row.
- [ ] Revoke the share and scan — the door must behave normally.

## Prerequisite before sales open

- [ ] Replace the placeholder GCash payee name and number in
      `src/lib/config/event.ts`. Real money routes through that value; read it
      off the actual account.

## What this plan deliberately does not do

- **No phone remote for the raffle.** One screen, one operator. A realtime
  channel between a phone and the projector is one more thing to fail in front
  of the whole room.
- **No offline raffle draw.** If the wifi is down the show pauses. That is a
  worse evening than a client-side draw, and a much better one than a result
  nobody can defend.
- **No seed-hash verifiability.** The spec lists it as optional and deferred;
  include it only if the org asks.
- ~~No admin UI for prizes. Config plus a redeploy, until that actually
  hurts.~~ It hurt sooner than expected — see the addendum below.

## Addendum (2026-09-02): admin-managed prizes and an entrant supplement

Testing the raffle live surfaced three problems, addressed without touching
the draw logic itself:

1. **Prizes moved from `RAFFLE_PRIZES` in config to `raffle_prizes`,
   admin-managed from `/admin/raffle`'s new Setup panel** — add, rename,
   reorder, delete, no code edit or redeploy. `supabase/migrations/
   0003_raffle_prizes_and_entrants.sql` adds the table; `prize-actions.ts`
   and `prize-manager.tsx` are the new files. `drawFromPool` in
   `src/lib/raffle/draw.ts` was untouched — it only ever saw an opaque
   `prizeKey` string, and still does.

2. **The wheel's slice labels were unreadable from a projector** (`text-sm`,
   truncated to 112px). `raffle-wheel.tsx` now sizes and wraps the label by
   finalist count instead. Verified in a headless-Chrome screenshot at 12, 8,
   and 4 finalists — every name fully readable at each size.

3. **An explicit, admin-only supplement to the eligible pool**, for someone
   the scanner missed or a name from outside the ticket system: add one by
   hand, or import a short `.xlsx` list. `raffle_extra_entrants` (same
   migration), `entrant-actions.ts`, `entrant-manager.tsx`. The scanned-in
   pool stays the default and the primary eligibility path — this is a
   visible addition, not a second way in, and a name that collides with an
   existing entrant (accidentally added twice, or coincidentally shares a
   name with someone already checked in) surfaces as a non-blocking warning
   at the moment it's added, not discovered after the draw.

`eligiblePool()` in `src/lib/raffle/queries.ts` now merges the auto pool with
`raffle_extra_entrants`; `drawFromPool` needed no change to accept the wider
pool, and the draw's original 15 tests pass unmodified — confirmation that
where an entrant came from was never the draw logic's concern.

`winner_registration_id`'s FK to `registrations` was dropped in the same
migration (an extra entrant has no such row) — see `context/SCHEMA.md`
`## raffle_draws` for why that's safe: `finalists` already snapshots the
winner's display data directly.

Not yet hand-verified end to end — needs `0003` pasted into the hosted
project first. See `docs/setup/supabase.md` §6 for the paste step, including
a verification query for the FK-drop's constraint name before running it.
