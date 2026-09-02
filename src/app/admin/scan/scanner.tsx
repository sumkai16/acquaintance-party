"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildIndex, resolveScan, type Resolution } from "@/lib/scans/resolve";
import type { Manifest, ManifestEntry } from "@/lib/scans/manifest";
import { startDecoder, type DecoderDiagnostics } from "@/lib/scans/camera";
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

const MANIFEST_REFRESH_MS = 20_000;
const SYNC_RETRY_MS = 15_000;
/** How long a result stays on screen before the scanner re-arms. */
const RESULT_HOLD_MS = 2_500;
/**
 * How long the scanner waits for a fresh manifest before arming the camera
 * anyway. Closes the window where a device scans in its first second on a
 * stale cached manifest and misses a check-in another door just recorded —
 * without this, a slow or absent connection would block the scanner
 * indefinitely, which the door can never afford.
 */
const BOOT_REFRESH_TIMEOUT_MS = 3_000;

/** Resolves with `value`, or `undefined` after `ms` — whichever is first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

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
  // Field-debugging aid: confirms the decode loop is actually running and
  // which engine is in use, from a screenshot, without needing device access.
  const [diag, setDiag] = useState<DecoderDiagnostics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // The label identifies this phone in the scan record, so a double-scan alert
  // on the dashboard can name which two doors saw the same ticket. Read after
  // mount, not as a lazy useState initializer, because localStorage doesn't
  // exist during the server render and reading it there would desync from
  // the client's first paint.
  useEffect(() => {
    const saved = localStorage.getItem("scanner-device-label");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDeviceLabel(saved);
  }, []);

  // Learns about admissions from OTHER devices, as long as this one is
  // online. This is what makes a second device recognize a ticket a first
  // device already let through within the same manifest-refresh window -
  // without it, cross-device duplicate detection would never work at all,
  // not even with a perfect connection.
  const absorbCheckIns = useCallback(async (manifest: Manifest) => {
    for (const entry of manifest.entries) {
      if (!entry.checkedInAt) continue;
      const existing = scannedRef.current.get(entry.code);
      if (existing && existing <= entry.checkedInAt) continue;
      scannedRef.current.set(entry.code, entry.checkedInAt);
      await markScanned(entry.code, entry.checkedInAt);
    }
  }, []);

  const refreshManifest = useCallback(async () => {
    try {
      const response = await fetch("/api/scan/manifest");
      if (!response.ok) return;
      const manifest: Manifest = await response.json();
      await saveManifest(manifest);
      indexRef.current = buildIndex(manifest);
      await absorbCheckIns(manifest);
      setManifestAt(manifest.generatedAt);
    } catch {
      // Offline. The cached manifest loaded at startup is still authoritative.
    }
  }, [absorbCheckIns]);

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
      scannedRef.current = await loadScannedCodes();
      if (cached) {
        indexRef.current = buildIndex(cached);
        setManifestAt(cached.generatedAt);
        await absorbCheckIns(cached);
      }
      setQueued(await pendingCount());
      // Wait briefly for a fresh manifest before arming the camera, so the
      // very first scan of the session can't land on stale cached data and
      // miss a check-in another door just recorded. Falls back to the cache
      // if the network is slow or absent — never blocks the scanner for long.
      await withTimeout(refreshManifest(), BOOT_REFRESH_TIMEOUT_MS);
      setReady(true);
      void flushQueue();
    })();
  }, [refreshManifest, flushQueue, absorbCheckIns]);

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

    startDecoder(videoRef.current, (code) => void handleCode(code), setDiag)
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

      <div className="absolute inset-x-0 top-0 flex flex-col gap-1 bg-black/60 p-3 text-sm text-white">
        <div className="flex justify-between gap-2">
          <span>{deviceLabel}</span>
          <div className="flex items-center gap-3">
            <span>
              {queued > 0 ? `${queued} waiting to sync` : "All scans synced"}
              {manifestAt ? "" : " · no manifest yet"}
            </span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void refreshManifest().finally(() => setRefreshing(false));
              }}
              className="rounded border border-white/40 px-2 py-1 text-xs disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh tickets"}
            </button>
          </div>
        </div>
        {diag ? (
          <div className="text-xs text-white/70">
            {diag.engine} · {diag.framesTried} frames tried
            {diag.lastError ? ` · last error: ${diag.lastError}` : ""}
          </div>
        ) : (
          <div className="text-xs text-white/70">decoder not started yet</div>
        )}
      </div>

      {!result && !cameraError ? <GuideFrame /> : null}

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

/**
 * A fixed "aim here" box — not tied to the detector's actual read position.
 * Mapping the detector's video-pixel coordinates onto the rendered
 * `object-cover` video element correctly is easy to get subtly wrong, and a
 * static target does what a volunteer needs: know where to point the phone.
 */
function GuideFrame() {
  const corner = "absolute h-8 w-8 border-white";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative h-64 w-64">
        <div className={`${corner} top-0 left-0 border-t-4 border-l-4`} />
        <div className={`${corner} top-0 right-0 border-t-4 border-r-4`} />
        <div className={`${corner} bottom-0 left-0 border-b-4 border-l-4`} />
        <div className={`${corner} bottom-0 right-0 border-b-4 border-r-4`} />
      </div>
    </div>
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
