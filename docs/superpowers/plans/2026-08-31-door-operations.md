# Door Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A volunteer at the door can scan a student's QR on a phone, get an unambiguous green/red answer in under a second with no network, and every scan reaches the server once the signal comes back. An organiser can watch attendance fill in and export it.

**Architecture:** The scanner resolves scans **entirely on-device** against an IndexedDB manifest of approved tickets, and queues every scan for later sync. The server is never in the decision path. Two authenticated route handlers serve the manifest and accept the queue; both hold the service-role key and verify the admin session themselves. Pure resolution logic lives in `src/lib/scans/resolve.ts` with unit tests, kept free of any `server-only` import so Vitest can load it (see `context/RULES.md`).

**Tech Stack:** Existing (Next 16, TypeScript, Tailwind v4, Supabase, Zod, Vitest) plus `@zxing/browser` (iOS camera fallback) and `exceljs` (`.xlsx` export).

**Spec:** `docs/superpowers/specs/2026-08-30-acquaintance-party-ticketing-design.md` §Scanner, §Admin, §Attendance record

**Plan 2 of 3.** Plan 1 (`2026-08-30-sell-and-verify.md`) is complete and verified end to end, including a real phone-camera scan of a live ticket. Plan 3 covers Google Sheets sync, landing polish, and the raffle wheel. This plan alone makes the event runnable at the door.

## Global Constraints

Everything in plan 1's Global Constraints still holds. In addition:

- **HTTPS is mandatory and now satisfied.** `getUserMedia` and `BarcodeDetector` are blocked on insecure origins. Production is `https://acquaintance-party.vercel.app`. **The scanner cannot be tested on `http://localhost` from a phone** — deploy to a Vercel preview and test there, or the camera silently never starts.
- **The scanner must never block on the network.** No `await fetch(...)` anywhere between reading a code and painting the result. If a step in this plan seems to need a round trip at scan time, it's wrong — re-read §Scanner in the spec.
- **The scan decision is made against the local manifest, and the server trusts the device's verdict.** Reconciliation happens after the fact on the dashboard, not by second-guessing the device at insert time. This is the accepted tradeoff in the spec (§Accepted limitation) — offline tolerance and perfect cross-device duplicate prevention are mutually exclusive.
- **Scans are append-only and idempotent.** The client generates each scan's `id` (a UUID) and the server upserts on it, so a retried batch never double-inserts. Never make sync depend on the client successfully deleting its queue first.
- **`scans` has no `insert` policy on any role.** All inserts go through the service-role client in a route handler. Don't add an `anon` or `authenticated` insert policy.
- **The scanner uses semantic color only** — green, red, amber. Never `--color-accent`. One state fills the screen at a time, and every state names a next action including the failure case. See `context/DESIGN.md` §5; this is a hard rule, not a preference.
- **The dashboard stays neutral and dense**, inheriting the existing `bg-slate-100` admin shell from `src/app/admin/layout.tsx`. Don't re-theme it.
- **Device clocks lie.** `scanned_at` is device time and may be minutes off; `synced_at` is server time. Never compute "scan rate" or ordering from `scanned_at` alone without saying which clock you mean.

---

## File Structure

**Pure logic — no I/O, no `server-only`, fully unit tested**
- `src/lib/scans/resolve.ts` — decides `ok` / `duplicate` / `invalid` against a manifest
- `src/lib/scans/manifest.ts` — manifest types + the shape shared by client and server
- `src/lib/scans/report.ts` — dashboard aggregates (counts, double-scan detection) from raw rows

**Client-only — runs in the browser, never imported by a server file**
- `src/lib/scans/store.ts` — IndexedDB: manifest cache, checked-in state, outbound queue
- `src/lib/scans/camera.ts` — `BarcodeDetector` with `@zxing/browser` fallback

**Server only**
- `src/lib/scans/queries.ts` — manifest read, scan upsert, dashboard reads (`server-only`)

**Routes**
- `src/app/admin/scan/page.tsx` + `scanner.tsx` (client) + `device-label.tsx`
- `src/app/api/scan/manifest/route.ts` — GET, authenticated
- `src/app/api/scan/sync/route.ts` — POST, authenticated, idempotent
- `src/app/admin/dashboard/page.tsx` + `refresh.tsx`
- `src/app/admin/dashboard/export/route.ts` — GET, streams `.xlsx`
- `public/manifest.webmanifest` + icons — installable to a phone home screen

**Modified**
- `src/proxy.ts` — extend the matcher to cover `/api/scan/*` so the session cookie refreshes
- `src/app/admin/review/page.tsx` — add a nav link to the scanner and dashboard

---

## Task 1: Scan resolution logic

The heart of the scanner, and the only part that decides anything. Written first, test-first, with no browser and no database in sight.

**Files:**
- Create: `src/lib/scans/manifest.ts`
- Create: `src/lib/scans/resolve.ts`
- Test: `src/lib/scans/resolve.test.ts`

**Interfaces:**
- Consumes: `normalizeScannedCode` from `@/lib/tickets/code` (added in step 3)
- Produces:
  - `type ManifestEntry = { code: string; registrationId: string; fullName: string; yearLevel: string; section: string }`
  - `type Manifest = { entries: ManifestEntry[]; generatedAt: string }`
  - `type LocalScan = { code: string; scannedAt: string }`
  - `type Resolution = { result: "ok"; entry: ManifestEntry } | { result: "duplicate"; entry: ManifestEntry; firstScannedAt: string } | { result: "invalid"; code: string }`
  - `resolveScan(rawCode: string, index: Map<string, ManifestEntry>, alreadyScanned: Map<string, string>): Resolution`
  - `buildIndex(manifest: Manifest): Map<string, ManifestEntry>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/scans/resolve.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIndex, resolveScan, type Manifest } from "./resolve";

const manifest: Manifest = {
  generatedAt: "2026-10-05T16:00:00+08:00",
  entries: [
    {
      code: "K4M92XQP7BTR",
      registrationId: "11111111-1111-1111-1111-111111111111",
      fullName: "Maria Clara Santos",
      yearLevel: "3rd year",
      section: "BSIT-3B",
    },
    {
      code: "V0GW3DP59EZF",
      registrationId: "22222222-2222-2222-2222-222222222222",
      fullName: "Juan Dela Cruz",
      yearLevel: "2nd year",
      section: "BSIT-2A",
    },
  ],
};

const index = buildIndex(manifest);
const nothingScanned = new Map<string, string>();

describe("resolveScan", () => {
  it("admits a valid, unscanned ticket", () => {
    const result = resolveScan("K4M92XQP7BTR", index, nothingScanned);
    expect(result.result).toBe("ok");
    if (result.result === "ok") {
      expect(result.entry.fullName).toBe("Maria Clara Santos");
    }
  });

  it("accepts the dashed form the ticket page displays", () => {
    // The QR encodes the bare code, but a volunteer may type what they see.
    expect(resolveScan("K4M9-2XQP-7BTR", index, nothingScanned).result).toBe("ok");
  });

  it("accepts lowercase, since a typed code is not guaranteed uppercase", () => {
    expect(resolveScan("k4m92xqp7btr", index, nothingScanned).result).toBe("ok");
  });

  it("flags a second scan of the same ticket as a duplicate", () => {
    const scanned = new Map([["K4M92XQP7BTR", "2026-10-05T20:14:00+08:00"]]);
    const result = resolveScan("K4M92XQP7BTR", index, scanned);
    expect(result.result).toBe("duplicate");
    if (result.result === "duplicate") {
      expect(result.firstScannedAt).toBe("2026-10-05T20:14:00+08:00");
      // The volunteer still needs the name to resolve the dispute in person.
      expect(result.entry.fullName).toBe("Maria Clara Santos");
    }
  });

  it("rejects a code that is not on the manifest", () => {
    const result = resolveScan("ZZZZZZZZZZZZ", index, nothingScanned);
    expect(result.result).toBe("invalid");
    if (result.result === "invalid") {
      expect(result.code).toBe("ZZZZZZZZZZZZ");
    }
  });

  it("rejects an arbitrary QR code from something else entirely", () => {
    expect(resolveScan("https://example.com", index, nothingScanned).result).toBe(
      "invalid",
    );
  });

  it("rejects an empty read rather than throwing", () => {
    expect(resolveScan("", index, nothingScanned).result).toBe("invalid");
  });

  it("keeps each ticket independent", () => {
    const scanned = new Map([["K4M92XQP7BTR", "2026-10-05T20:14:00+08:00"]]);
    expect(resolveScan("V0GW3DP59EZF", index, scanned).result).toBe("ok");
  });
});

describe("buildIndex", () => {
  it("indexes every manifest entry by its code", () => {
    expect(index.size).toBe(2);
    expect(index.get("K4M92XQP7BTR")?.section).toBe("BSIT-3B");
  });

  it("survives an empty manifest", () => {
    expect(buildIndex({ generatedAt: "", entries: [] }).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/scans/resolve.test.ts
```

Expected: FAIL — `Failed to resolve import "./resolve"`.

- [ ] **Step 3: Add code normalization to the ticket module**

The scanner must accept what a camera reads *and* what a volunteer types. Add to `src/lib/tickets/code.ts`:

```ts
/**
 * Canonicalizes a code read from a camera or typed by a volunteer.
 *
 * The QR encodes the bare 12-character code, but the ticket page *displays*
 * the dashed form, so a fallback "type it in" path will see dashes. Casing is
 * normalized because a phone keyboard will happily send lowercase.
 */
export function normalizeScannedCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}
```

Add matching tests to `src/lib/tickets/code.test.ts`:

```ts
describe("normalizeScannedCode", () => {
  it("strips the display dashes", () => {
    expect(normalizeScannedCode("K4M9-2XQP-7BTR")).toBe("K4M92XQP7BTR");
  });

  it("uppercases a typed code", () => {
    expect(normalizeScannedCode("k4m92xqp7btr")).toBe("K4M92XQP7BTR");
  });

  it("round-trips a formatted generated code", () => {
    const code = generateTicketCode();
    expect(normalizeScannedCode(formatTicketCode(code))).toBe(code);
  });

  it("reduces junk to something that simply will not match", () => {
    expect(normalizeScannedCode("https://example.com")).toBe("HTTPSEXAMPLECOM");
  });
});
```

Remember to add `normalizeScannedCode` to the import at the top of that test file.

- [ ] **Step 4: Implement**

Create `src/lib/scans/manifest.ts`:

```ts
/**
 * The shape the scanner caches offline. Deliberately minimal: 600 of these is
 * roughly 60KB, small enough to hold in IndexedDB and re-download on a whim.
 *
 * It carries no email, no receipt path, and no GCash reference — a scanner
 * phone is passed between volunteers and may be left unlocked on a table.
 */
export type ManifestEntry = {
  code: string;
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
};

export type Manifest = {
  entries: ManifestEntry[];
  /** Server clock when the manifest was generated. */
  generatedAt: string;
};
```

Create `src/lib/scans/resolve.ts`:

```ts
import { normalizeScannedCode } from "@/lib/tickets/code";
import type { Manifest, ManifestEntry } from "./manifest";

export type { Manifest, ManifestEntry };

export type Resolution =
  | { result: "ok"; entry: ManifestEntry }
  | { result: "duplicate"; entry: ManifestEntry; firstScannedAt: string }
  | { result: "invalid"; code: string };

export function buildIndex(manifest: Manifest): Map<string, ManifestEntry> {
  return new Map(manifest.entries.map((entry) => [entry.code, entry]));
}

/**
 * Decides what happens at the door, with no network and no database.
 *
 * `alreadyScanned` maps a code to the timestamp it was first accepted **on
 * this device**. Cross-device duplicates cannot be caught here — see the
 * spec's §Accepted limitation — and are surfaced on the dashboard instead.
 */
export function resolveScan(
  rawCode: string,
  index: Map<string, ManifestEntry>,
  alreadyScanned: Map<string, string>,
): Resolution {
  const code = normalizeScannedCode(rawCode);
  const entry = index.get(code);

  if (!entry) return { result: "invalid", code };

  const firstScannedAt = alreadyScanned.get(code);
  if (firstScannedAt) return { result: "duplicate", entry, firstScannedAt };

  return { result: "ok", entry };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

```powershell
npm test
```

Expected: PASS — the 10 new resolve tests, the 4 new normalization tests, and every pre-existing test still green.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: resolve door scans against an offline ticket manifest"
```

---

## Task 2: Manifest and sync endpoints

**Files:**
- Create: `src/lib/scans/queries.ts`
- Create: `src/app/api/scan/manifest/route.ts`
- Create: `src/app/api/scan/sync/route.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `adminClient`, `serverClient`, `Manifest`
- Produces:
  - `approvedManifest(): Promise<Manifest>`
  - `recordScans(rows: ScanRow[]): Promise<{ ok: true; accepted: number } | { ok: false; error: string }>`
  - `GET /api/scan/manifest` → `Manifest`, 401 when signed out
  - `POST /api/scan/sync` → `{ accepted: number }`, 401 when signed out

- [ ] **Step 1: Extend the proxy matcher**

The scan endpoints live under `/api`, which the current matcher doesn't cover, so the admin's session cookie would never refresh during a long night at the door. In `src/proxy.ts`:

```ts
export const config = {
  matcher: ["/admin/:path*", "/api/scan/:path*"],
};
```

The route handlers still verify the session themselves — the proxy only keeps the cookie fresh. Never rely on the proxy alone for authorization.

- [ ] **Step 2: Write the queries**

Create `src/lib/scans/queries.ts`:

```ts
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Manifest } from "./manifest";
import type { ScanResult } from "@/lib/supabase/types";

export type ScanRow = {
  id: string;
  registrationId: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

/** Every approved ticket, in the minimal shape the scanner caches. */
export async function approvedManifest(): Promise<Manifest> {
  const { data, error } = await adminClient()
    .from("registrations")
    .select("id, ticket_code, full_name, year_level, section")
    .eq("status", "approved")
    .not("ticket_code", "is", null);

  if (error) {
    console.error("approvedManifest failed", error);
    throw new Error("Could not load the ticket manifest.");
  }

  return {
    generatedAt: new Date().toISOString(),
    entries: (data ?? []).map((row) => ({
      code: row.ticket_code as string,
      registrationId: row.id as string,
      fullName: row.full_name as string,
      yearLevel: row.year_level as string,
      section: row.section as string,
    })),
  };
}

/**
 * Inserts a batch of queued scans.
 *
 * The client generates each `id`, so a retried batch upserts onto the same
 * rows instead of double-counting attendance. `ignoreDuplicates` means a
 * re-sync is a no-op rather than an error — the scanner retries blindly on an
 * interval and must never be punished for it.
 */
export async function recordScans(
  rows: ScanRow[],
): Promise<{ ok: true; accepted: number } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: true, accepted: 0 };

  const { error } = await adminClient()
    .from("scans")
    .upsert(
      rows.map((row) => ({
        id: row.id,
        registration_id: row.registrationId,
        code_scanned: row.codeScanned,
        scanned_at: row.scannedAt,
        device_label: row.deviceLabel,
        result: row.result,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    console.error("recordScans failed", error);
    return { ok: false, error: "Could not save scans." };
  }

  return { ok: true, accepted: rows.length };
}
```

- [ ] **Step 3: Write the manifest endpoint**

Create `src/app/api/scan/manifest/route.ts`:

```ts
import { serverClient } from "@/lib/supabase/server";
import { approvedManifest } from "@/lib/scans/queries";

// The manifest lists every valid ticket code. Signed-in admins only — this is
// the one artifact that would let someone forge an entry.
export async function GET() {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  try {
    return Response.json(await approvedManifest(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not load the ticket manifest." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Write the sync endpoint**

Create `src/app/api/scan/sync/route.ts`:

```ts
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { recordScans } from "@/lib/scans/queries";

const scanSchema = z.object({
  id: z.string().uuid(),
  registrationId: z.string().uuid().nullable(),
  codeScanned: z.string().min(1).max(64),
  scannedAt: z.string().datetime({ offset: true }),
  deviceLabel: z.string().min(1).max(40),
  result: z.enum(["ok", "duplicate", "invalid"]),
});

// One phone can bank a whole evening of scans during a blackout. Cap the batch
// so a single request stays well inside the body limit; the client chunks.
const batchSchema = z.object({ scans: z.array(scanSchema).max(200) });

export async function POST(request: Request) {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Malformed scan batch." }, { status: 400 });
  }

  const result = await recordScans(parsed.data.scans);
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 });

  return Response.json({ accepted: result.accepted });
}
```

- [ ] **Step 5: Verify both endpoints reject an anonymous caller**

```powershell
npm run dev
```

In a **private/incognito** window (no admin cookie):

```
http://localhost:3000/api/scan/manifest
```

Expected: `401` with `{"error":"Sign in again."}`. Then sign in at `/admin/login` in a normal window and reload — expected: JSON with an `entries` array.

This check is the whole reason the handlers verify the session themselves rather than trusting the proxy. Do not skip it.

- [ ] **Step 6: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: serve the ticket manifest and accept queued scans"
```

---

## Task 3: Offline store and camera

**Files:**
- Create: `src/lib/scans/store.ts`
- Create: `src/lib/scans/camera.ts`

**Interfaces:**
- Produces:
  - `openStore(): Promise<IDBDatabase>`
  - `saveManifest(m: Manifest)`, `loadManifest(): Promise<Manifest | null>`
  - `markScanned(code, scannedAt)`, `loadScannedCodes(): Promise<Map<string, string>>`
  - `queueScan(row: QueuedScan)`, `pendingScans(limit)`, `clearScans(ids: string[])`, `pendingCount()`
  - `startDecoder(video, onCode): Promise<() => void>`

- [ ] **Step 1: Install the camera fallback**

```powershell
npm install @zxing/browser
```

`BarcodeDetector` is native on Android Chrome and absent on iOS Safari, which is a guaranteed half of the phones at any Philippine school event. The fallback is not optional.

- [ ] **Step 2: Write the IndexedDB store**

Create `src/lib/scans/store.ts`. This file is imported only from client components — it must never gain a `server-only` import, and never be imported by a route handler.

```ts
import type { Manifest } from "./manifest";
import type { ScanResult } from "@/lib/supabase/types";

const DB_NAME = "acquaintance-scanner";
const DB_VERSION = 1;

const MANIFEST = "manifest";
const SCANNED = "scanned";
const QUEUE = "queue";

export type QueuedScan = {
  id: string;
  registrationId: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openStore(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MANIFEST)) db.createObjectStore(MANIFEST);
      if (!db.objectStoreNames.contains(SCANNED)) db.createObjectStore(SCANNED);
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  body: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openStore().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = body(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const saveManifest = (m: Manifest) =>
  run(MANIFEST, "readwrite", (s) => s.put(m, "current"));

export const loadManifest = () =>
  run<Manifest | undefined>(MANIFEST, "readonly", (s) => s.get("current")).then(
    (m) => m ?? null,
  );

/** Records that a code was admitted on this device, for duplicate detection. */
export const markScanned = (code: string, scannedAt: string) =>
  run(SCANNED, "readwrite", (s) => s.put(scannedAt, code));

export async function loadScannedCodes(): Promise<Map<string, string>> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const store = db.transaction(SCANNED, "readonly").objectStore(SCANNED);
    const keys = store.getAllKeys();
    const values = store.getAll();
    const tx = store.transaction;
    tx.oncomplete = () =>
      resolve(
        new Map(
          (keys.result as string[]).map((key, i) => [
            key,
            values.result[i] as string,
          ]),
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}

export const queueScan = (row: QueuedScan) =>
  run(QUEUE, "readwrite", (s) => s.put(row));

export const pendingScans = (limit = 200) =>
  run<QueuedScan[]>(QUEUE, "readonly", (s) => s.getAll(undefined, limit));

export const pendingCount = () => run<number>(QUEUE, "readonly", (s) => s.count());

export async function clearScans(ids: string[]): Promise<void> {
  const db = await openStore();
  const tx = db.transaction(QUEUE, "readwrite");
  const store = tx.objectStore(QUEUE);
  for (const id of ids) store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 3: Write the camera decoder**

Create `src/lib/scans/camera.ts`:

```ts
/**
 * Starts decoding QR codes from a live camera stream and returns a stop
 * function.
 *
 * Native `BarcodeDetector` where it exists (Android Chrome) — it is faster and
 * costs no bundle weight. `@zxing/browser` everywhere else, which in practice
 * means every iPhone, since Safari has never shipped BarcodeDetector.
 */
export async function startDecoder(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // The back camera. Without this a laptop or a front-facing phone opens the
    // selfie camera and the volunteer cannot see what they are aiming at.
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true"); // iOS otherwise goes fullscreen
  await video.play();

  const stopStream = () => stream.getTracks().forEach((track) => track.stop());

  const Detector = (
    globalThis as unknown as { BarcodeDetector?: new (o: object) => {
      detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    } }
  ).BarcodeDetector;

  if (Detector) {
    const detector = new Detector({ formats: ["qr_code"] });
    let running = true;

    const tick = async () => {
      if (!running) return;
      try {
        const [first] = await detector.detect(video);
        if (first?.rawValue) onCode(first.rawValue);
      } catch {
        // A dropped frame is not an error worth surfacing; the next one lands
        // ~100ms later. Anything fatal shows up as the stream ending instead.
      }
      if (running) setTimeout(tick, 100);
    };
    void tick();

    return () => {
      running = false;
      stopStream();
    };
  }

  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const controls = await new BrowserQRCodeReader().decodeFromVideoElement(
    video,
    (result) => {
      if (result) onCode(result.getText());
    },
  );

  return () => {
    controls.stop();
    stopStream();
  };
}
```

- [ ] **Step 4: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: add offline scan store and camera decoding"
```

---

## Task 4: The scanner page

The surface a volunteer actually uses. Function first, semantic color only, one state filling the screen.

**Files:**
- Create: `src/app/admin/scan/page.tsx`
- Create: `src/app/admin/scan/scanner.tsx`
- Modify: `src/app/admin/review/page.tsx` (nav link)

- [ ] **Step 1: Write the page shell**

Create `src/app/admin/scan/page.tsx`:

```tsx
import { Scanner } from "./scanner";

export const metadata = { title: "Door scanner" };

export default function ScanPage() {
  return <Scanner />;
}
```

- [ ] **Step 2: Write the scanner client component**

Create `src/app/admin/scan/scanner.tsx`. The result panel is deliberately enormous — this is read at arm's length, in the dark, by someone with a queue in front of them.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildIndex, resolveScan, type Resolution } from "@/lib/scans/resolve";
import type { Manifest, ManifestEntry } from "@/lib/scans/manifest";
import { startDecoder } from "@/lib/scans/camera";
import {
  clearScans,
  loadManifest,
  loadScannedCodes,
  markScanned,
  pendingCount,
  pendingScans,
  queueScan,
  saveManifest,
} from "@/lib/scans/store";

const MANIFEST_REFRESH_MS = 60_000;
const SYNC_RETRY_MS = 15_000;
/** How long a result stays on screen before the scanner re-arms. */
const RESULT_HOLD_MS = 2_500;

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const indexRef = useRef(new Map<string, ManifestEntry>());
  const scannedRef = useRef(new Map<string, string>());
  const lockedRef = useRef(false);

  const [deviceLabel, setDeviceLabel] = useState("");
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<Resolution | null>(null);
  const [queued, setQueued] = useState(0);
  const [manifestAt, setManifestAt] = useState<string | null>(null);

  // The label identifies this phone in the scan record, so a double-scan alert
  // on the dashboard can name which two doors saw the same ticket.
  useEffect(() => {
    const saved = localStorage.getItem("scanner-device-label");
    if (saved) setDeviceLabel(saved);
  }, []);

  const refreshManifest = useCallback(async () => {
    try {
      const response = await fetch("/api/scan/manifest");
      if (!response.ok) return;
      const manifest: Manifest = await response.json();
      await saveManifest(manifest);
      indexRef.current = buildIndex(manifest);
      setManifestAt(manifest.generatedAt);
    } catch {
      // Offline. The cached manifest loaded at startup is still authoritative.
    }
  }, []);

  const flushQueue = useCallback(async () => {
    const batch = await pendingScans();
    setQueued(await pendingCount());
    if (batch.length === 0) return;

    try {
      const response = await fetch("/api/scan/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scans: batch }),
      });
      if (!response.ok) return; // keep them queued and try again
      await clearScans(batch.map((scan) => scan.id));
      setQueued(await pendingCount());
    } catch {
      // Still offline. Nothing is lost; the interval will try again.
    }
  }, []);

  // Boot from cache first so the scanner works even if it opens with no signal.
  useEffect(() => {
    void (async () => {
      const cached = await loadManifest();
      if (cached) {
        indexRef.current = buildIndex(cached);
        setManifestAt(cached.generatedAt);
      }
      scannedRef.current = await loadScannedCodes();
      setQueued(await pendingCount());
      setReady(true);
      void refreshManifest();
      void flushQueue();
    })();
  }, [refreshManifest, flushQueue]);

  useEffect(() => {
    const manifestTimer = setInterval(refreshManifest, MANIFEST_REFRESH_MS);
    const syncTimer = setInterval(flushQueue, SYNC_RETRY_MS);
    return () => {
      clearInterval(manifestTimer);
      clearInterval(syncTimer);
    };
  }, [refreshManifest, flushQueue]);

  const handleCode = useCallback(
    async (raw: string) => {
      // A camera fires many frames per second at the same code. Without this
      // lock one ticket becomes twenty scans and the first is followed by
      // nineteen duplicates.
      if (lockedRef.current) return;
      lockedRef.current = true;

      const scannedAt = new Date().toISOString();
      const resolution = resolveScan(raw, indexRef.current, scannedRef.current);
      setResult(resolution);

      if (resolution.result === "ok") {
        scannedRef.current.set(resolution.entry.code, scannedAt);
        await markScanned(resolution.entry.code, scannedAt);
      }

      await queueScan({
        id: crypto.randomUUID(),
        registrationId:
          resolution.result === "invalid" ? null : resolution.entry.registrationId,
        codeScanned:
          resolution.result === "invalid" ? resolution.code : resolution.entry.code,
        scannedAt,
        deviceLabel: deviceLabel || "unlabelled",
        result: resolution.result,
      });
      setQueued(await pendingCount());
      void flushQueue();

      setTimeout(() => {
        setResult(null);
        lockedRef.current = false;
      }, RESULT_HOLD_MS);
    },
    [deviceLabel, flushQueue],
  );

  useEffect(() => {
    if (!ready || !deviceLabel || !videoRef.current) return;
    let stop: (() => void) | undefined;

    startDecoder(videoRef.current, (code) => void handleCode(code))
      .then((s) => (stop = s))
      .catch(() =>
        setCameraError(
          "The camera could not start. Check that this page is on https and that you allowed camera access.",
        ),
      );

    return () => stop?.();
  }, [ready, deviceLabel, handleCode]);

  if (!deviceLabel) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Name this scanner</h1>
        <p className="text-slate-600">
          Give this phone a door name, so a double entry can be traced to the
          lane it came through. Example: <code>door-1</code>.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("label");
            const label = String(value ?? "").trim();
            if (!label) return;
            localStorage.setItem("scanner-device-label", label);
            setDeviceLabel(label);
          }}
          className="flex flex-col gap-3"
        >
          <input
            name="label"
            required
            autoFocus
            placeholder="door-1"
            className="rounded border border-slate-400 px-3 py-3 text-lg"
          />
          <button className="rounded bg-slate-900 px-6 py-3 text-lg font-semibold text-white">
            Start scanning
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-black">
      <video ref={videoRef} muted className="h-screen w-full object-cover" />

      <div className="absolute inset-x-0 top-0 flex justify-between gap-2 bg-black/60 p-3 text-sm text-white">
        <span>{deviceLabel}</span>
        <span>
          {queued > 0 ? `${queued} waiting to sync` : "All scans synced"}
          {manifestAt ? "" : " · no manifest yet"}
        </span>
      </div>

      {cameraError ? (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-amber-400 p-4 text-lg font-semibold text-black"
        >
          {cameraError}
        </p>
      ) : null}

      {result ? <ResultPanel resolution={result} /> : null}
    </main>
  );
}

// Semantic color only — green/red/amber, never the theme accent. Every state
// names a next action, including the failures. See context/DESIGN.md §5.
function ResultPanel({ resolution }: { resolution: Resolution }) {
  if (resolution.result === "ok") {
    return (
      <Panel className="bg-green-600">
        <p className="text-5xl font-black uppercase">Let them in</p>
        <p className="text-4xl font-bold">{resolution.entry.fullName}</p>
        <p className="text-2xl">
          {resolution.entry.yearLevel} · Section {resolution.entry.section}
        </p>
        <p className="text-lg opacity-90">Check the name against their ID.</p>
      </Panel>
    );
  }

  if (resolution.result === "duplicate") {
    const at = new Date(resolution.firstScannedAt).toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <Panel className="bg-red-700">
        <p className="text-5xl font-black uppercase">Already scanned</p>
        <p className="text-4xl font-bold">{resolution.entry.fullName}</p>
        <p className="text-2xl">Came through at {at}.</p>
        <p className="text-lg opacity-90">
          Send them to the organiser at the desk — do not scan again.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="bg-red-700">
      <p className="text-5xl font-black uppercase">Not a valid ticket</p>
      <p className="break-all font-mono text-xl">{resolution.code || "(empty)"}</p>
      <p className="text-lg opacity-90">
        Search their name at the desk instead — they may have a ticket that was
        never approved.
      </p>
    </Panel>
  );
}

function Panel({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Link it from the review queue**

In `src/app/admin/review/page.tsx`, alongside the existing "Find a registration" link, add links to `/admin/scan` and `/admin/dashboard`. Volunteers will be handed a phone and told "open the admin page" — make the scanner one tap from there.

- [ ] **Step 4: Verify on a real phone over HTTPS**

Push the branch and open the Vercel **preview** URL on an actual phone. `localhost` will not work — the camera needs a secure origin, and a phone cannot reach your machine's localhost anyway.

Confirm each stated result:

1. Open `/admin/scan` signed out → redirected to `/admin/login` (the admin layout gate).
2. Sign in, open `/admin/scan` → prompted for a device label; enter `door-1`.
3. Camera opens using the **back** camera, not the selfie camera.
4. Scan an approved ticket → **green**, correct name and section.
5. Scan the same ticket again → **red**, "already scanned", with the time of the first scan.
6. Scan any other QR code (a Wi-Fi code, a product barcode) → **red**, "not a valid ticket".
7. Put the phone in airplane mode, scan two more approved tickets → both still resolve instantly, and the header shows scans waiting to sync.
8. Turn the network back on, wait ~15 seconds → the header returns to "All scans synced".
9. In the Supabase dashboard, confirm `scans` holds one row per scan with the right `result`, `device_label`, and a `synced_at` later than `scanned_at` for the offline ones.

Check 7 is the one that matters most: it is the entire reason this design exists.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: add the offline-tolerant door scanner"
```

---

## Task 5: Installable to a home screen

A volunteer should tap an icon, not find a URL in a browser history at 7pm.

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the web manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Acquaintance Party Door Scanner",
  "short_name": "Door Scan",
  "start_url": "/admin/scan",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`display: standalone` removes the browser chrome, which matters: a volunteer cannot accidentally navigate away mid-queue.

- [ ] **Step 2: Add the icons**

Any square PNG at 192px and 512px. These are placeholders unless the org has a logo — note them on the "Before launch" checklist in `docs/setup/supabase.md` alongside `public/gcash-qr.png`.

- [ ] **Step 3: Reference it from the root layout**

In `src/app/layout.tsx`, add to the exported `metadata`:

```ts
manifest: "/manifest.webmanifest",
```

- [ ] **Step 4: Verify the install**

On the phone, open the preview URL, then "Add to Home Screen". Launch from the icon and confirm it opens `/admin/scan` full-screen with no address bar, and that the camera still works from the installed shell.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: make the scanner installable to a phone home screen"
```

---

## Task 6: Attendance aggregates

Pure logic again — the counting and the double-scan detection, tested without a database.

**Files:**
- Create: `src/lib/scans/report.ts`
- Test: `src/lib/scans/report.test.ts`

**Interfaces:**
- Produces: `summarize(rows: ScanRecord[], ticketsSold: number): Summary`, `findDoubleScans(rows: ScanRecord[]): DoubleScan[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/scans/report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findDoubleScans, summarize, type ScanRecord } from "./report";

const row = (over: Partial<ScanRecord> = {}): ScanRecord => ({
  registrationId: "r1",
  fullName: "Maria Clara Santos",
  codeScanned: "K4M92XQP7BTR",
  scannedAt: "2026-10-05T16:10:00+08:00",
  deviceLabel: "door-1",
  result: "ok",
  ...over,
});

describe("summarize", () => {
  it("counts distinct students admitted, not raw scans", () => {
    const summary = summarize(
      [row(), row({ result: "duplicate" }), row({ result: "duplicate" })],
      600,
    );
    expect(summary.checkedIn).toBe(1);
    expect(summary.totalScans).toBe(3);
  });

  it("reports how many sold tickets have not arrived", () => {
    const summary = summarize([row(), row({ registrationId: "r2" })], 600);
    expect(summary.checkedIn).toBe(2);
    expect(summary.notYetArrived).toBe(598);
  });

  it("counts invalid scans separately, since they are not attendance", () => {
    const summary = summarize(
      [row(), row({ registrationId: null, result: "invalid" })],
      600,
    );
    expect(summary.checkedIn).toBe(1);
    expect(summary.invalid).toBe(1);
  });

  it("handles an empty night without dividing by zero", () => {
    const summary = summarize([], 600);
    expect(summary.checkedIn).toBe(0);
    expect(summary.notYetArrived).toBe(600);
  });
});

describe("findDoubleScans", () => {
  it("flags one ticket admitted at two different doors", () => {
    const found = findDoubleScans([
      row(),
      row({ deviceLabel: "door-2", scannedAt: "2026-10-05T16:12:00+08:00" }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].devices).toEqual(["door-1", "door-2"]);
    expect(found[0].fullName).toBe("Maria Clara Santos");
  });

  it("ignores a repeat the device already caught as a duplicate", () => {
    // The scanner said no the second time, so nobody got in twice.
    expect(
      findDoubleScans([row(), row({ result: "duplicate", deviceLabel: "door-2" })]),
    ).toHaveLength(0);
  });

  it("ignores the same door scanning once", () => {
    expect(findDoubleScans([row()])).toHaveLength(0);
  });

  it("returns nothing for a clean night", () => {
    expect(findDoubleScans([row(), row({ registrationId: "r2" })])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```powershell
npm test -- src/lib/scans/report.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/scans/report.ts`:

```ts
import type { ScanResult } from "@/lib/supabase/types";

export type ScanRecord = {
  registrationId: string | null;
  fullName: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

export type Summary = {
  checkedIn: number;
  notYetArrived: number;
  totalScans: number;
  invalid: number;
};

export type DoubleScan = {
  registrationId: string;
  fullName: string | null;
  devices: string[];
};

export function summarize(rows: ScanRecord[], ticketsSold: number): Summary {
  const admitted = new Set(
    rows
      .filter((row) => row.result === "ok" && row.registrationId)
      .map((row) => row.registrationId as string),
  );

  return {
    checkedIn: admitted.size,
    notYetArrived: Math.max(0, ticketsSold - admitted.size),
    totalScans: rows.length,
    invalid: rows.filter((row) => row.result === "invalid").length,
  };
}

/**
 * One ticket admitted by two different devices.
 *
 * This is the after-the-fact half of the accepted offline limitation: during a
 * blackout two phones cannot coordinate, so the same ticket can pass at two
 * lanes. A `duplicate` result is *not* a double scan — that is the scanner
 * working correctly and turning someone away.
 */
export function findDoubleScans(rows: ScanRecord[]): DoubleScan[] {
  const byRegistration = new Map<string, ScanRecord[]>();

  for (const row of rows) {
    if (row.result !== "ok" || !row.registrationId) continue;
    const existing = byRegistration.get(row.registrationId);
    if (existing) existing.push(row);
    else byRegistration.set(row.registrationId, [row]);
  }

  const found: DoubleScan[] = [];
  for (const [registrationId, scans] of byRegistration) {
    const devices = [...new Set(scans.map((scan) => scan.deviceLabel))].sort();
    if (devices.length > 1) {
      found.push({ registrationId, fullName: scans[0].fullName, devices });
    }
  }
  return found;
}
```

- [ ] **Step 4: Run the tests and confirm they pass, then commit**

```powershell
npm test
git add -A
git commit -m "feat: summarize attendance and detect cross-device double scans"
```

---

## Task 7: The dashboard

**Files:**
- Create: `src/app/admin/dashboard/page.tsx`
- Modify: `src/lib/scans/queries.ts` (add the dashboard read)

- [ ] **Step 1: Add the dashboard query**

Append to `src/lib/scans/queries.ts`:

```ts
import type { ScanRecord } from "./report";

/** Every scan with the student's name joined in, newest first. */
export async function allScans(): Promise<ScanRecord[]> {
  const { data, error } = await adminClient()
    .from("scans")
    .select(
      "code_scanned, scanned_at, device_label, result, registration_id, registrations(full_name)",
    )
    .order("scanned_at", { ascending: false });

  if (error) {
    console.error("allScans failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    registrationId: row.registration_id as string | null,
    fullName:
      (row.registrations as { full_name: string } | null)?.full_name ?? null,
    codeScanned: row.code_scanned as string,
    scannedAt: row.scanned_at as string,
    deviceLabel: row.device_label as string,
    result: row.result as ScanRecord["result"],
  }));
}

export async function approvedCount(): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return count ?? 0;
}
```

- [ ] **Step 2: Write the dashboard page**

Create `src/app/admin/dashboard/page.tsx`. Neutral and dense, inheriting the admin shell — no theme accent.

```tsx
import Link from "next/link";
import { allScans, approvedCount } from "@/lib/scans/queries";
import { findDoubleScans, summarize } from "@/lib/scans/report";

export const metadata = { title: "Attendance" };
// Attendance changes every few seconds during the event; never serve a cached
// count to someone deciding whether to open the doors wider.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [scans, sold] = await Promise.all([allScans(), approvedCount()]);
  const summary = summarize(scans, sold);
  const doubles = findDoubleScans(scans);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/scan" className="underline">
            Scanner
          </Link>
          <Link href="/admin/review" className="underline">
            Review queue
          </Link>
          <a href="/admin/dashboard/export" className="underline">
            Download .xlsx
          </a>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checked in" value={summary.checkedIn} />
        <Stat label="Tickets sold" value={sold} />
        <Stat label="Not yet arrived" value={summary.notYetArrived} />
        <Stat label="Invalid scans" value={summary.invalid} />
      </dl>

      {doubles.length > 0 ? (
        <section className="mt-8 rounded border border-red-300 bg-red-50 p-4">
          <h2 className="font-bold text-red-800">
            {doubles.length} ticket{doubles.length === 1 ? "" : "s"} admitted at
            more than one door
          </h2>
          <p className="mt-1 text-sm text-red-800">
            This can happen when devices are offline and cannot see each
            other&apos;s scans. Check these students in person.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {doubles.map((double) => (
              <li key={double.registrationId}>
                <strong>{double.fullName ?? "Unknown"}</strong> —{" "}
                {double.devices.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mt-8 font-bold">Recent scans</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Door</th>
              <th className="py-2">Code</th>
            </tr>
          </thead>
          <tbody>
            {scans.slice(0, 100).map((scan, i) => (
              <tr key={`${scan.codeScanned}-${i}`} className="border-b border-slate-200">
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {new Date(scan.scannedAt).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-1.5 pr-3">{scan.fullName ?? "—"}</td>
                <td className="py-1.5 pr-3">{scan.result}</td>
                <td className="py-1.5 pr-3">{scan.deviceLabel}</td>
                <td className="py-1.5 font-mono text-xs">{scan.codeScanned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scans.length === 0 ? (
          <p className="py-6 text-slate-600">
            No scans yet. They appear here as soon as a scanner syncs.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-300 bg-white p-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Build and commit**

```powershell
npm run build
git add -A
git commit -m "feat: add the attendance dashboard with double-scan alerts"
```

---

## Task 8: `.xlsx` export

The fallback that turns a disaster into an inconvenience if Sheets sync (plan 3) fails on the night.

**Files:**
- Create: `src/app/admin/dashboard/export/route.ts`

- [ ] **Step 1: Install the writer**

```powershell
npm install exceljs
```

- [ ] **Step 2: Write the export route**

Create `src/app/admin/dashboard/export/route.ts`:

```ts
import ExcelJS from "exceljs";
import { serverClient } from "@/lib/supabase/server";
import { allScans } from "@/lib/scans/queries";
import { EVENT } from "@/lib/config/event";

export async function GET() {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  const scans = await allScans();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.columns = [
    { header: "Scanned at", key: "scannedAt", width: 22 },
    { header: "Name", key: "fullName", width: 28 },
    { header: "Result", key: "result", width: 12 },
    { header: "Door", key: "deviceLabel", width: 12 },
    { header: "Code", key: "codeScanned", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const scan of scans) {
    sheet.addRow({
      scannedAt: new Date(scan.scannedAt).toLocaleString("en-PH"),
      fullName: scan.fullName ?? "",
      result: scan.result,
      deviceLabel: scan.deviceLabel,
      codeScanned: scan.codeScanned,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${EVENT.name.toLowerCase().replace(/\s+/g, "-")}-attendance.xlsx`;

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
```

- [ ] **Step 3: Verify by hand**

Signed in, click "Download .xlsx" on the dashboard. Confirm the file opens in Excel or Sheets, has a bold header row, and holds one row per scan. Signed out (private window), hitting the URL directly returns `401`.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: export attendance as xlsx"
```

---

## Task 9: End-to-end rehearsal

Not a code task. Plan 1 was called code-complete once and turned out to have never been clicked through; do not repeat that.

- [ ] **Step 1: Rehearse with two phones**

On the deployed preview, with two different phones both signed in and labelled `door-1` and `door-2`:

1. Approve three fresh test registrations.
2. Scan ticket A on door-1 → green.
3. Scan ticket A again on door-1 → red, already scanned.
4. Put **both** phones in airplane mode.
5. Scan ticket B on door-1 → green. Scan ticket B on door-2 → **green** (this is the accepted limitation, and seeing it happen is the point).
6. Scan ticket C on door-2 → green.
7. Bring both phones back online, wait ~15s.
8. Open the dashboard: `checkedIn` counts A, B, C once each; the double-scan panel names ticket B across `door-1, door-2`.
9. Download the `.xlsx` and confirm every scan from both phones is present.

- [ ] **Step 2: Clean up the rehearsal data**

Delete the test registrations, their receipts, and their scans. `scans` cascades on registration delete, so removing the registration is enough — confirm the `scans` table is empty afterward.

- [ ] **Step 3: Update the context layer**

- `context/PRD.md` §4 — tick the scanner and dashboard/export boxes, update the status line.
- `context/ARCHITECTURE.md` §6 — add `src/lib/scans/` and the new routes to the folder map; §7 — note that the scanner syncs on an interval from the client, still no server-side scheduled work.
- `context/SCHEMA.md` — `scans` is no longer "not yet written to by any code".
- `context/DESIGN.md` §7 — the scanner exists now.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "docs: record plan 2 as verified at the door"
```

---

## What this plan deliberately does not do

- **No service worker.** The scanner needs the *data* offline, which IndexedDB
  covers; it does not need the app shell offline, because a volunteer opens it
  once at the start of the night and never reloads. A service worker would add
  a cache-invalidation failure mode on event night for no gain. Revisit only if
  a phone is observed losing the page mid-event.
- **No realtime dashboard.** It re-renders on load and on refresh. Someone
  watching the door count does not need sub-second updates, and Supabase
  Realtime on top of an already-syncing queue is a second thing to debug at
  8pm.
- **No server-side duplicate rejection.** Deliberate — see the spec's
  §Accepted limitation and the dashboard's double-scan panel.
- **No Google Sheets sync.** That is plan 3. The `.xlsx` export exists so that
  plan 2 alone survives the event.
