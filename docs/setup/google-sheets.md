# Google Sheets live sync (optional)

Appends a row to a Google Sheet every time a scan reaches the server, so
organisers can leave the Sheet open and watch attendance fill in during the
event.

**This is a projection, not the record.** Postgres is the source of truth and
`/admin/dashboard/export` produces the same data as `.xlsx` on demand. If any
of the three environment variables is missing, the sync is skipped silently —
the door, the dashboard, and the export all behave exactly the same. Set it up
if it is useful; skip it if the account approval drags.

## 1. Create a service account

1. https://console.cloud.google.com → create a project (or reuse one).
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Any name; no roles are needed — access comes from sharing the Sheet, not
   from IAM.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   The file downloads once.

Treat that JSON like the service-role key: never commit it, never paste it
into chat or a screenshot. If it leaks, delete the key in the console and
create a new one.

## 2. Create the Sheet and share it

1. Create a spreadsheet. The sync appends to the **first tab**, whatever it is
   called — it does not look up a tab by name.
2. Put this header row in row 1, in this order:

   ```
   Scanned at (device) | Synced at (server) | Name | Year level | Section | Ticket code | Door | Result
   ```

   The order is the contract, set by `SHEET_HEADERS` in
   `src/lib/sheets/row.ts`. Rows are appended below whatever is already there,
   so the header is for the humans reading it — but a mismatched header means
   the columns lie.
3. **Share** the Sheet with the service account's email (the `client_email`
   field in the JSON, ending `@...iam.gserviceaccount.com`) as **Editor**.
   Skipping this is the single most common reason nothing appears.

Both timestamps are written in Manila time. `Scanned at` is the phone's clock
and can be minutes out; `Synced at` is the server's. The gap between them is
how long that device was offline.

## 3. Set the environment variables

From the JSON key file:

| Variable | JSON field |
|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | `client_email` |
| `GOOGLE_SHEETS_PRIVATE_KEY` | `private_key` — one line, newlines as `\n`, keep the quotes |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | from the Sheet's URL, between `/d/` and `/edit` |

Add all three locally in `.env.local`, and in Vercel under **Settings →
Environment Variables** for Production. Redeploy after adding them — env vars
are baked in at deploy time, so an existing deployment will not pick them up.

## 4. Check it works

1. Scan a ticket (or approve and scan a test registration).
2. A row appears in the Sheet within a few seconds of the scanner syncing.
3. Put the scanner in airplane mode, scan, then restore the connection. The
   queued scan syncs and produces **exactly one** row — retries do not append
   again, because only rows the database actually inserted are published.

If nothing appears, check the deployment logs. Every failure is logged and
swallowed on purpose:

- `Google token request responded with 400` — usually a malformed
  `GOOGLE_SHEETS_PRIVATE_KEY` (newlines not written as `\n`).
- `Sheets append responded with 403` — the Sheet is not shared with the
  service account, or the Sheets API is not enabled on the project.
- `Sheets append responded with 404` — wrong `GOOGLE_SHEETS_SPREADSHEET_ID`.

None of these affect the door. That is the point.
