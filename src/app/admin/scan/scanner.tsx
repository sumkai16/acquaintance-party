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
  // Field-debugging aid: confirms the decode loop is actually running and
  // which engine is in use, from a screenshot, without needing device access.
  const [diag, setDiag] = useState<DecoderDiagnostics | null>(null);

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
          <span>
            {queued > 0 ? `${queued} waiting to sync` : "All scans synced"}
            {manifestAt ? "" : " · no manifest yet"}
          </span>
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
