# Backups, and what to do if Supabase is unreachable

Two different failures, two different answers. Read the one you're in.

- **An outage** — Supabase is down for an hour, the data is fine. The door
  keeps working; see §3. Nothing is lost.
- **Data loss** — a table dropped, a project deleted, a bad migration. The
  only thing that saves you is a file somebody already downloaded. See §1.

The free plan has no point-in-time recovery. Verify what your project
actually has under **Database → Backups** in the Supabase dashboard before
assuming a safety net exists.

## 1. The backup file

**Dashboard → Download backup** produces
`acquaintance-party-registrations-YYYY-MM-DD.xlsx`: every registration, every
status, amounts as real numbers, ticket codes, who approved what, and the
storage path of each receipt. Always the whole table — it ignores whatever
search or filter is on screen, deliberately.

This is the only copy of the money record outside Supabase. The scan manifest
on the door phones holds ticket codes but no payees; the Google Sheet mirrors
scans only.

**Download it:**

- once a week while sales are open,
- **the morning of the event**, and
- again after the last walk-in is entered on the night.

Keep each one — don't overwrite. Put the event-morning copy somewhere that is
not the laptop it was downloaded on: a phone, Drive, a second machine. A
backup that lives only on the device that fails with you is not a backup.

Receipt images are **not** in the file, only their paths. They are evidence
for payment disputes, which by event night are already settled by the
approval decision itself. If you want them too, download the `receipts`
bucket from the Supabase dashboard separately.

**Attendance → Download .xlsx** is the companion file, and it answers the
other question: who actually got in. Pull it after the doors close.

## 2. Restoring from it

The .xlsx is a record, not a restore script — there is no import-registrations
button, and writing one for an emergency nobody has had is not worth the code.
What the file guarantees is that the event can still run and the money can
still be accounted for with the app gone entirely: every payee, what they
paid, and their ticket code, in a form any phone can open.

If the database is lost *before* the event, the practical path is a fresh
Supabase project, the migrations in `supabase/migrations/` applied in order,
and the walk-in spreadsheet import (**Walk-in → Import**) fed from the backup
columns — its template is at **Walk-in → Download template**.

## 3. If Supabase is down on the night

**The door is fine. Don't panic and don't restart anything.**

The scanner (`src/app/admin/scan/scanner.tsx`) downloads the full ticket
manifest on startup and caches it. When `/api/scan/manifest` stops answering
it keeps scanning against that cached copy, banks every scan locally, and
pushes the queue through `/api/scan/sync` when the network returns. Scans then
mirror into the Google Sheet as usual.

What this means in practice:

- **Open the scanner on every door phone *before* doors open, while the
  network is up.** This is the one step that matters. A phone that has never
  loaded a manifest has nothing to check tickets against. The screen says
  "no manifest yet" when this has gone wrong — look for it.
- Don't hard-refresh a scanner phone during an outage. It needs the network
  to reload the app.
- Duplicate detection still works, per device, against the cached manifest.
  Two doors can't see each other's check-ins while offline — a ticket scanned
  at both doors during the blackout is caught on sync, not at the door.

**Walk-ins are the real casualty.** Recording one writes to Supabase, so
during an outage there is no way to log a cash sale in the app.

Fall back to paper: **name, student ID, year & section, email, amount paid**,
one line each, and keep the cash separate from cash already reconciled. When
the database is back, enter them through **Walk-in → Import** using the
template — the same route the pre-event spreadsheet import uses. Student IDs
are case-folded on import, so it doesn't matter how they were written down.

## 4. Quick reference

| Situation | Do this |
|---|---|
| Weekly, while selling | Dashboard → Download backup |
| Morning of the event | Download backup; copy it off the laptop |
| Before doors open | Open the scanner on every door phone, confirm no "no manifest yet" |
| Supabase down, doors open | Keep scanning. Walk-ins go on paper |
| Network back | Scanners sync themselves; enter paper walk-ins via Walk-in → Import |
| After doors close | Dashboard → Download backup, Attendance → Download .xlsx |
