---
target: public checkout flow (landing, checkout, ticket page)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-02T17-09-07Z
slug: public-checkout-flow-landing-checkout-ticket-page
---
Method: dual-agent (A: design review, isolated sub-agent · B: detector + browser evidence, isolated sub-agent — neither saw the other's output)

# Critique — Landing → Checkout → Ticket (Sunset Soiree theme, confirmed)

Scope: the three public, themed surfaces treated as one flow, since a real student moves through all three in sequence. Assessment A did a full live walkthrough including a real throwaway submission that reached a genuine pending ticket page. Assessment B ran the deterministic detector plus a real browser overlay (script-injected, not simulated) on landing and checkout, with static screenshots for all three. I re-verified several of B's key screenshots myself before writing this.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Clear pending/approved/rejected branching on the ticket page; no ETA on review time anywhere |
| 2 | Match Between System and Real World | 4 | GCash reference number, peso formatting, receipt upload — built for how a BSIT student actually pays, not a generic "payment method" |
| 3 | User Control and Freedom | 2 | Only the rejected state offers a recovery action; no self-service way to recover a lost ticket link |
| 4 | Consistency and Standards | 4 | Anton/burnt-clay/Step-rhythm carried identically across all three surfaces |
| 5 | Error Prevention | 3 | Zod validation, file checks, unique-reference index, throttle; no receipt thumbnail preview before submit |
| 6 | Recognition Rather Than Recall | 2 | Student holds a 13-digit reference number in memory across an app-switch with no on-page help |
| 7 | Flexibility and Efficiency of Use | 3 | Typed values survive a rejected/throttled resubmit; nothing persists across a closed tab |
| 8 | Aesthetic and Minimalist Design | 4 | One accent color doing all the work, generous whitespace, nothing decorative competing with content |
| 9 | Error Recovery | 3 | Specific, plain-language errors, values preserved on failure |
| 10 | Help and Documentation | 2 | The FAQ is genuinely good but marooned on landing — unreachable from checkout or the ticket page |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

**Where the detector and the design review agree, independently:** Assessment A judged (before seeing any detector output) that the *content* is unmistakably specific to this product but the *structural language* is generic marketing-template — hero → three-card grid → three-step list → FAQ accordion → CTA band. Assessment B's mechanical scan then quantified exactly that pattern without knowing A's conclusion: a `hero-eyebrow-chip` on both landing ("BSIT DEPARTMENT PRESENTS" above "Acquaintance Party") and checkout ("Step 1" above "Pay with GCash"), plus `kicker-above-heading` twice on landing ("What you get" → "Your ticket includes", "How it works" → "Three steps"). Four instances of the single most common SaaS-landing move, caught mechanically, independently corroborating the qualitative read. I verified the overlay screenshots myself — the yellow-boxed findings are real, not a claimed effect.

**Content specificity, confirmed:** `inputMode="numeric"` on the GCash reference field, the exact hint text, a real payee QR through `next/image`, peso formatting built from `Intl` parts specifically to strip the non-breaking space. No template site has this.

**Net:** authored-for-the-brand, template-for-the-structure. Given `PRODUCT.md`'s explicit "no logo, no fabricated imagery" and the project's own priority order ("the door and the money are load-bearing, the theme is not"), this is a defensible allocation — but there's real headroom between "no fabricated assets" and "generic SaaS scaffolding" that costs nothing to close (see Priority Issues).

**Deterministic scan, full breakdown:**
- Landing (`src/app/page.tsx`): 1× `hero-eyebrow-chip`, 2× `low-contrast` (3.9:1, need 4.5:1 — the "GET YOUR TICKET" button label), 4× `line-length` (~89 chars/line, aim <80), 2× `kicker-above-heading`
- Checkout (`src/app/checkout/page.tsx` + `checkout-form.tsx`): 1× `hero-eyebrow-chip`, 1× `low-contrast` (same 3.9:1 pair, the "SUBMIT" button label)
- Ticket page: not independently scannable live (no test id at scan time), but it shares the identical `bg-accent … text-ground` class pairing that produced the contrast finding elsewhere — structurally the same issue is plausible there too, and Assessment A's separate live walkthrough (via a real throwaway submission) found the same *family* of contrast problem on that page directly (see Priority Issues).
- No false positives identified in either assessment.

**Visual overlays:** Real, script-injected, browser-console-confirmed by Assessment B (`[impeccable] 8 anti-patterns found`, live-server + `agent-browser eval`) — not simulated. The browser session has since closed, so nothing is live in a tab right now, but I re-opened and inspected the saved screenshots myself and confirm the yellow highlight boxes and labels are real, matching the findings above exactly.

## Overall Impression

This is a well-built, disciplined system wearing a template's skeleton. The token discipline (one accent color, no hardcoded hex anywhere, QR-on-white enforced even under theme pressure) is genuinely above-average craft, and the copy is specific and honest throughout. But the design effort is currently weighted toward the calmest part of the journey — the landing page, where a student has already decided to attend — and thin at the two moments that actually carry risk: checkout, where a first-time payer sends real money with zero trust signal, and the pending-ticket wait, which is the true emotional peak of the whole flow and currently gets a beige card with no timeframe and no confirmation email. The single biggest opportunity isn't a redesign of the landing page — it's closing the trust and confirmation gaps at checkout and after.

## What's Working

1. **The checkout form is built for GCash, not "a payment method."** `inputMode="numeric"`, exact hint text, a real payee QR through `next/image` — doesn't read like a generic template with labels swapped.
2. **Errors don't punish the student for someone else's problem.** The `key={attempt}` remount pattern in `checkout-form.tsx` exists specifically so a throttle hit or duplicate-reference rejection doesn't wipe a correctly typed name and email.
3. **The QR-on-white rule is enforced, not just documented.** `ApprovedTicket` keeps the ticket QR untouched by the theme even though everything else on that page is themed — the one decision with an immediate, in-person, socially-visible consequence (a bouncer's phone failing to focus) is exactly where discipline held.

## Priority Issues

**[P1] No confirmation reaches the student outside the browser tab they're sitting in**
- **Why it matters**: The email field's stated purpose is "so we can find it if you lose the link," but nothing is ever sent to it — `notifyNewRegistration` only pings a Discord webhook, for admins. If a tab dies or closes before "bookmark this," the only recovery is asking an admin to search by hand, for a real ₱495 payment already sent. This is the same class of silent-failure bug the project already got burned by once (the honeypot/autofill incident in `context/PRD.md` §6) — this one just hasn't been discovered by a real student yet.
- **Fix**: Send a one-line email with the ticket link on submit, ideally again on approval. Same `after()` pattern already used for the Discord ping.
- **Suggested command**: `/impeccable harden`

**[P1] Contrast failures against the project's own documented 4.5:1 standard, in two related but distinct places**
- **Where**: Detector-confirmed 3.9:1 (`#f2e3cb` on `#c2481f`) on the primary CTA and Submit button labels — the two highest-stakes click targets in the entire flow — on both landing and checkout. Separately, `text-ink/60` (used for every section eyebrow, the back link, the footer, and ticket-page labels) computes to roughly 4.0–4.3:1, also under the line, confirmed live on the actual ticket page Assessment A reached.
- **Why it matters**: `context/DESIGN.md` §6 and `PRODUCT.md`'s Accessibility section both commit to 4.5:1. This isn't a subjective call — it's the project failing its own written rule, on the buttons that convert.
- **Fix**: Button labels need a lighter tint or a darker button background to clear 4.5:1. Muted text should move to `ink/70` or a dedicated token instead of an arbitrary opacity value.
- **Suggested command**: `/impeccable audit`

**[P1] Mobile checkout puts a full screen-and-a-half of payment info between the student and the form**
- **Why it matters**: The task already requires holding a 13-digit number in memory across an app-switch (heuristic 6). Making the student scroll past a large QR image first — confirmed in the mobile screenshot — compounds it. Desktop's two-column layout sidesteps this entirely; it's mobile-specific, and this product is mobile-first by necessity per `PRODUCT.md`.
- **Fix**: On narrow viewports, collapse the payment block to payee name/number/amount, with the QR behind a toggle (a phone can't scan its own screen anyway) — or pin a compact reference-number reminder once the form scrolls into view.
- **Suggested command**: `/impeccable layout`

**[P2] Zero trust signal at the point of real financial risk**
- **Why it matters**: Checkout asks a first-time payer to send money to a plaintext personal name and number, with no verification cue — structurally identical to the pattern GCash-scam warnings tell students to be wary of. `context/PRD.md` already flags the current values as placeholders to swap before launch, but the *design* gap — no trust signal at all, regardless of whose name is in the field — survives that swap.
- **Fix**: One line of copy tying the account to a channel the student already trusts (e.g. "the same number posted in the BSIT block group chat").
- **Suggested command**: `/impeccable clarify`

**[P3] No estimated review turnaround anywhere in the flow**
- **Why it matters**: "Not instant" and "come back later" both appear; neither gives any sense of scale for what is, by design, the longest wait in the whole journey.
- **Fix**: Even a hedged bound ("usually reviewed within a day") beats no information.
- **Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Casey (Distracted Mobile User)**
- Scrolls past the full GCash block + QR before reaching "Full name"; interrupted mid-scroll, nothing pre-fills or resumes.
- The QR on her own checkout screen can't be scanned by her own phone's camera — the page never says so, and the manual-entry fallback isn't flagged as the expected mobile path.

**Jordan (Confused First-Timer)**
- The FAQ answering "how long," "what if rejected," "can I screenshot my QR" lives only on landing — arriving at `/checkout` directly (a shared link, a poster QR) reaches none of it.
- "Waiting for approval" gives no sense of normal timing — no way to tell "working as intended" from "stuck."
- The only contact channel is unlinked prose ("Message the BSIT Department page on Facebook") — has to leave the flow and search.

**Ella (project-specific — BSIT student, budget Android, GCash-savvy but scam-wary)**
- The GCash block reads exactly like the scam pattern she's trained herself to distrust — nothing distinguishes an official department collection from a stranger.
- No bookmarking habit plus no email confirmation means her only proof of payment can vanish the moment she closes the tab.
- She's precisely who "reviewed within X hours" would matter most to — with no ETA, multi-day silence reads as "did this even go through."

## Minor Observations

- The unstyled `<input type="file">` ("Choose File / No file chosen") is the one element on checkout not visually integrated with the themed form; no thumbnail preview to confirm the right screenshot was picked.
- Rejected → "Submit again" sends the student to a fully blank form — none of the four non-payment fields survive, forcing full re-entry for a rejection that likely wasn't their fault.
- "Section" is the one form field with no hint or example; a stray "e.g. BSIT-3A" would reduce format drift an admin has to parse later.
- Detector flagged 4× lines around 89 characters (aim <80) on landing — minor readability nit, not urgent.
- Next.js's dev-mode indicator (the black circular "N" badge, bottom-left) overlaps body copy on both landing and checkout mobile screenshots — confirmed dev-only chrome, does not ship to production, not a real issue.
- The apparent "strikethrough" on ₱495 that Assessment B flagged as unconfirmed is not a bug — I checked the screenshots directly: it's the peso sign's actual glyph design (a horizontal bar through the P), visible identically at both body-copy and large display sizes, which a real rendering bug wouldn't produce consistently.
- Real Next.js dev warning, both pages: `/gcash-qr.png` is the Largest Contentful Paint element with no `loading="eager"` — a small, concrete perf fix.

## Questions to Consider

1. If GCash is the only payment method, why does checkout still read like a generic billing form rather than something that visually rhymes with the GCash transfer receipt Ella already trusts?
2. The pending ticket state is the true emotional peak of this flow — real money sent, waiting on a stranger's manual review. Is a beige "Waiting for approval" card the confident note that moment deserves?
3. The team already found and fixed one silent-failure bug the hard way (real autofill killing a real submission). Is "no confirmation email for a real-money payment" the next one waiting to be found on event day itself?
