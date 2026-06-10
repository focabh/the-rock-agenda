// Wrapper mínimo de IndexedDB (sem dependência). Um banco "rock-offline" com
// dois object stores:
//   - "kv"    : pares chave→valor (snapshot, metadados de sync) — chave externa
//   - "queue" : fila de mutações offline (keyPath "id") — chave embutida
import type { QueuedMutation } from "./types";

const DB_NAME = "rock-offline";
const DB_VERSION = 1;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB indisponível"));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("queue"))
          db.createObjectStore("queue", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(
  store: "kv" | "queue",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest
): Promise<T> {
  return getDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

// ---- kv (snapshot + metadados) ----
export const kvGet = <T>(key: string) =>
  run<T | undefined>("kv", "readonly", (s) => s.get(key));
export const kvSet = (key: string, val: unknown) =>
  run<IDBValidKey>("kv", "readwrite", (s) => s.put(val as unknown as never, key));
export const kvDel = (key: string) =>
  run<undefined>("kv", "readwrite", (s) => s.delete(key));

// ---- queue (mutações offline) ----
export const queuePut = (item: QueuedMutation) =>
  run<IDBValidKey>("queue", "readwrite", (s) => s.put(item));
export const queueAll = () =>
  run<QueuedMutation[]>("queue", "readonly", (s) => s.getAll());
export const queueDel = (id: string) =>
  run<undefined>("queue", "readwrite", (s) => s.delete(id));
export const queueCount = () =>
  run<number>("queue", "readonly", (s) => s.count());
