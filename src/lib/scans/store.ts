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
