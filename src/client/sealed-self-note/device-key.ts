// The DEK on this device (WEB-NF6-SIFRA, SRV contract self-note-sealed-v1 §5): one non-extractable
// CryptoKey in IndexedDB, with its keyId and the tag of the session it was unlocked in.
// Sign-out removes it: `forgetDeviceKey` for the sign-out itself, and every read drops a key
// whose session is no longer the browser's current one or has ended (session-marks.ts), so a
// sign-out in another tab, or one whose page never called this module, still leaves nothing usable.

import { browserCookieJar, browserMarkStore, currentSession, hasEnded, type CookieJar, type MarkStore } from "../session-marks";
import { KEY_ID } from "./codec";

export type DeviceKey = { readonly keyId: string; readonly key: CryptoKey };
type KeptKey = { readonly keyId: string; readonly key: CryptoKey; readonly session: { readonly tag: string; readonly at: number } | null };

/** Where the key lives; IndexedDB in the browser, a map in tests. */
export type KeyVault = {
  read(): Promise<KeptKey | null>;
  write(record: KeptKey): Promise<void>;
  clear(): Promise<void>;
};

const DB_NAME = "ductura-sealed-self-note";
const STORE = "device-key";
const SLOT = "current";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb"));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const req = factory.open(DB_NAME, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
  return request(req);
}

async function inStore<T>(factory: IDBFactory, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb(factory);
  try {
    const tx = db.transaction(STORE, mode);
    const result = await request(run(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexeddb"));
      tx.onabort = () => reject(tx.error ?? new Error("indexeddb"));
    });
    return result;
  } finally {
    db.close();
  }
}

/** The IndexedDB vault; null where the browser has none. */
export function indexedDbVault(factory: IDBFactory | undefined = globalThis.indexedDB): KeyVault | null {
  if (factory === undefined) return null;
  return {
    read: async () => (await inStore(factory, "readonly", (store) => store.get(SLOT) as IDBRequest<KeptKey | undefined>)) ?? null,
    write: async (record) => { await inStore(factory, "readwrite", (store) => store.put(record, SLOT)); },
    clear: async () => { await inStore(factory, "readwrite", (store) => store.delete(SLOT)); },
  };
}

export type DeviceKeyDeps = { readonly vault: KeyVault | null; readonly marks: MarkStore | null; readonly jar: CookieJar | null };

export function browserDeviceKeyDeps(): DeviceKeyDeps {
  return { vault: indexedDbVault(), marks: browserMarkStore(), jar: browserCookieJar() };
}

function isRecord(value: unknown): value is KeptKey {
  if (typeof value !== "object" || value === null) return false;
  const { keyId, key, session } = value as Record<string, unknown>;
  const sessionOk = session === null || (typeof session === "object" && session !== null
    && typeof (session as Record<string, unknown>).tag === "string" && typeof (session as Record<string, unknown>).at === "number");
  return typeof keyId === "string" && KEY_ID.test(keyId) && typeof CryptoKey !== "undefined" && key instanceof CryptoKey
    && key.extractable === false && sessionOk;
}

/** Keeps the unlocked DEK for the session the browser records now. False without storage. */
export async function keepDeviceKey(value: DeviceKey, deps: DeviceKeyDeps = browserDeviceKeyDeps()): Promise<boolean> {
  if (deps.vault === null || value.key.extractable) return false;
  const mark = currentSession(deps.marks);
  try {
    await deps.vault.write({ keyId: value.keyId, key: value.key, session: mark === null ? null : { tag: mark.tag, at: mark.at } });
    return true;
  } catch {
    return false;
  }
}

/** Removes the DEK from this device. True when nothing is left (or there was no storage). */
export async function forgetDeviceKey(deps: DeviceKeyDeps = browserDeviceKeyDeps()): Promise<boolean> {
  if (deps.vault === null) return true;
  try {
    await deps.vault.clear();
    return true;
  } catch {
    return false;
  }
}

/**
 * The DEK of the current session, or null. A key kept under another session, under a session
 * that has ended, or in a malformed record is removed first and never returned.
 */
export async function readDeviceKey(deps: DeviceKeyDeps = browserDeviceKeyDeps()): Promise<DeviceKey | null> {
  if (deps.vault === null) return null;
  let record: unknown;
  try {
    record = await deps.vault.read();
  } catch {
    return null;
  }
  if (record === null || record === undefined) return null;
  const current = currentSession(deps.marks);
  const kept = isRecord(record) ? record : null;
  const sameSession = kept !== null && (kept.session === null
    ? current === null
    : current !== null && current.tag === kept.session.tag && !hasEnded(deps.marks, kept.session, deps.jar));
  if (kept === null || !sameSession) {
    await forgetDeviceKey(deps);
    return null;
  }
  return { keyId: kept.keyId, key: kept.key };
}
