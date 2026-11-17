import type { MessageKey } from "../../locales/hr.ts";

/**
 * Storage fallbacks (DAN-754, web 2.c5, cut B; Risk critical per web PLAN
 * §7). Private windows lose text silently when nobody checks: Firefox before
 * 115 fails `indexedDB.open` with `InvalidStateError`, Safari throws
 * `SecurityError` or gives `localStorage` a zero quota. These probes turn each
 * of those into an answer the interface can warn about. They never throw.
 *
 * A browser that opens IndexedDB in a private window and drops it when the
 * window closes (newer Firefox, Safari 17+) reports `available`: the probe
 * cannot tell that from a normal window without guessing by user agent.
 */

const STORAGE_UNAVAILABLE = "editor.failureUnavailable" satisfies MessageKey;

export type IndexedDbProbe =
  | { state: "available" }
  | {
      state: "unavailable";
      reason: "missing" | "blocked" | "error" | "timeout";
      messageKey: typeof STORAGE_UNAVAILABLE;
    };

/** The parts of an `IDBOpenDBRequest` the probe uses. */
export interface ProbeOpenRequest {
  // `never` parameters, so the DOM's `IDBOpenDBRequest` (handlers taking an
  // Event) is assignable and the browser global object typechecks as env.
  onsuccess: ((event: never) => unknown) | null;
  onerror: ((event: never) => unknown) | null;
  readonly result?: { close(): void } | undefined;
}

/** The parts of `IDBFactory` the probe uses. */
export interface ProbeIdbFactory {
  open(name: string): ProbeOpenRequest;
  deleteDatabase(name: string): unknown;
}

/** The parts of `Storage` this module uses and returns. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear" | "key" | "length">;

export interface StorageEnv {
  indexedDB?: ProbeIdbFactory | null;
  localStorage?: StorageLike | null;
}

/** Largest delay a browser timer keeps (2^31 - 1 ms). */
const MAX_TIMER_MS = 2_147_483_647;

/** Name of the database the probe opens and deletes again. */
export const PROBE_DATABASE = "ductura-platform-probe";

function unavailable(reason: "missing" | "blocked" | "error" | "timeout"): IndexedDbProbe {
  return { state: "unavailable", reason, messageKey: STORAGE_UNAVAILABLE };
}

function discard(factory: ProbeIdbFactory, request: ProbeOpenRequest): void {
  try {
    request.result?.close();
  } catch {
    // Already closed or never opened.
  }
  try {
    factory.deleteDatabase(PROBE_DATABASE);
  } catch {
    // Nothing more to clean.
  }
}

/**
 * Opens and deletes a probe database. `available` only after a real
 * `onsuccess` inside `timeoutMs`, measured when the event runs; a success
 * that comes later still leaves `timeout`, and the probe database is deleted either way. Pass the browser global object.
 */
export function probeIndexedDb(env: StorageEnv, timeoutMs = 2000): Promise<IndexedDbProbe> {
  let factory: ProbeIdbFactory | null | undefined;
  let opens: boolean;
  try {
    factory = env.indexedDB;
    opens = !!factory && typeof factory.open === "function";
  } catch {
    return Promise.resolve(unavailable("blocked"));
  }
  if (!factory || !opens) return Promise.resolve(unavailable("missing"));
  const idb = factory;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer: IndexedDbProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(answer);
    };
    // Timers overflow above 2^31 - 1 ms and fire at once; clamp instead. A
    // non-finite or negative deadline means an immediate timeout.
    const delay = Number.isFinite(timeoutMs) ? Math.min(Math.max(0, timeoutMs), MAX_TIMER_MS) : 0;
    const timer = setTimeout(() => finish(unavailable("timeout")), delay);
    // A busy main thread can run onsuccess after the deadline but before the
    // timer callback; the elapsed time decides then, not the order of events.
    // A wall clock jump forward only turns a success into a warning.
    const started = Date.now();

    let request: ProbeOpenRequest;
    try {
      request = idb.open(PROBE_DATABASE);
    } catch {
      finish(unavailable("blocked"));
      return;
    }
    try {
      request.onsuccess = () => {
        discard(idb, request);
        finish(Date.now() - started <= delay ? { state: "available" } : unavailable("timeout"));
      };
      request.onerror = () => {
        discard(idb, request);
        finish(unavailable("error"));
      };
    } catch {
      finish(unavailable("error"));
    }
  });
}

/** A `Storage` in memory: what the page keeps until it is closed. */
export function memoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    // WebIDL unsigned long: NaN is 0, fractions are cut.
    key: (index) => [...items.keys()][Math.trunc(Number(index)) >>> 0] ?? null,
    getItem: (key) => items.get(String(key)) ?? null,
    setItem: (key, value) => void items.set(String(key), String(value)),
    removeItem: (key) => void items.delete(String(key)),
    clear: () => items.clear(),
  };
}

const PROBE_KEY = "ductura-platform-probe";

/**
 * `localStorage` when it can really write, otherwise a store in memory with
 * `persistent: false`, so the interface can warn instead of losing silently
 * (Safari private windows throw `QuotaExceededError` on the first `setItem`).
 */
export function safeLocalStorage(env: StorageEnv): { storage: StorageLike; persistent: boolean } {
  try {
    const storage = env.localStorage;
    if (!storage) return { storage: memoryStorage(), persistent: false };
    storage.setItem(PROBE_KEY, PROBE_KEY);
    const readBack = storage.getItem(PROBE_KEY);
    storage.removeItem(PROBE_KEY);
    if (readBack !== PROBE_KEY) return { storage: memoryStorage(), persistent: false };
    return { storage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
