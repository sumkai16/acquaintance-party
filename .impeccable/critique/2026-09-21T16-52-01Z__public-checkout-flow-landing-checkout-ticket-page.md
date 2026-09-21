---
target: "public checkout flow: landing, checkout, ticket page"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-21T16-52-01Z
slug: public-checkout-flow-landing-checkout-ticket-page
---
# Critique: public student flow (landing, checkout, ticket) — 2026-09-22

Method: dual-agent. Score 28/40 (Good).

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Ticket states clear; no step tracker or turnaround time |
| 2 | Match real world | 3 | "Reference number" vs GCash "Ref No." |
| 3 | User control | 2 | No edit/cancel after submit; "Submit again" starts blank |
| 4 | Consistency | 3 | Rejected state uses raw <a> instead of Link |
| 5 | Error prevention | 3 | Strong email/ID/OCR checks; refund and ref-match not stated |
| 6 | Recognition | 2 | Payee, amount, ref number must be carried across the GCash app-switch |
| 7 | Flexibility | 3 | autocomplete, inputMode, OCR autofill |
| 8 | Minimalist | 3 | Landing and checkout tight |
| 9 | Error recovery | 3 | One-pass errors, values kept; error text same weight as hints |
| 10 | Help | 3 | FAQ + hints; contact only in footer |

Design specificity: landing authored; checkout and ticket generic (about 60% authored).

Priority issues
- [P1] Checkout has no anchor for payment details after returning from GCash (layout)
- [P1] Post-submit state is the weakest moment: no turnaround, no receipt summary (clarify)
- [P2] Mobile hero may lose its photo at 390 wide; verify on device (adapt)
- [P2] Theme stops at landing; ticket has no shared motif (colorize/bolder on ticket only)
- [P3] Placeholder ink/40 and footer ground/60 contrast; ticket lacks time and venue (polish)

Detector: gradient-text at src/app/page.tsx:115 (deliberate brand signature; false positive by intent). Scanner border-l/r-4 hits are viewfinder brackets (false positive). Browser: no console errors, no overflow; checkout back link 179x18px and file input 36px tall are under 44px.
