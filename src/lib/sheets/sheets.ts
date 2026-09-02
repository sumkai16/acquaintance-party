import "server-only";
import { createSign } from "node:crypto";
import { approvedManifest } from "@/lib/scans/queries";
import type { InsertedScan } from "@/lib/scans/queries";
import { sheetRow } from "./row";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Credentials = {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
};

function credentials(): Credentials | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  // Vercel stores the key with literal \n, since env vars are single-line.
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) return null;
  return { clientEmail, privateKey, spreadsheetId };
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/**
 * Exchanges a self-signed JWT for an access token.
 *
 * Hand-rolled rather than pulling in googleapis: this is the only Google call
 * the project makes, and the library is very large for one values.append.
 */
async function accessToken(creds: Credentials): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const claim = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;

  const signature = createSign("RSA-SHA256")
    .update(claim)
    .sign(creds.privateKey)
    .toString("base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${claim}.${signature}`,
    }),
  });

  if (!response.ok) {
    console.error(
      "Google token request responded with",
      response.status,
      await response.text(),
    );
    return null;
  }

  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

/**
 * Appends freshly recorded scans to the live Sheet.
 *
 * Never throws and never blocks the door. Postgres is the record and the
 * dashboard's .xlsx export is the fallback, so a Google outage, a revoked
 * share, or a missing credential has to be a log line and nothing more.
 *
 * Only ever called with rows the upsert actually inserted — the scanner
 * retries queued batches blindly every 15 seconds, and appending on a retry
 * would list the same student over and over.
 */
export async function publishScans(inserted: InsertedScan[]): Promise<void> {
  if (inserted.length === 0) return;

  const creds = credentials();
  if (!creds) return; // Not configured — skip silently, not an error.

  try {
    const manifest = await approvedManifest();
    const byId = new Map(
      manifest.entries.map((entry) => [entry.registrationId, entry]),
    );

    const rows = inserted.map((scan) => {
      const entry = scan.registrationId ? byId.get(scan.registrationId) : null;
      return sheetRow({
        codeScanned: scan.codeScanned,
        scannedAt: scan.scannedAt,
        syncedAt: scan.syncedAt,
        deviceLabel: scan.deviceLabel,
        result: scan.result,
        fullName: entry?.fullName ?? null,
        yearLevel: entry?.yearLevel ?? null,
        section: entry?.section ?? null,
      });
    });

    const token = await accessToken(creds);
    if (!token) return;

    // No sheet name in the range, so this appends to the first tab whatever
    // it is called — see docs/setup/google-sheets.md.
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${creds.spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ values: rows }),
      },
    );

    if (!response.ok) {
      console.error(
        "Sheets append responded with",
        response.status,
        await response.text(),
      );
    }
  } catch (error) {
    console.error("Sheets append failed", error);
  }
}
