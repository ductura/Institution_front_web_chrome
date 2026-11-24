// WEB-V20-PREF-CITANJE: the one container for reading preferences. localStorage "ductura.reading.v1", never the server.
// Blocked or throwing storage does not break the screen: the choice then holds for this visit only.
import {
  DEFAULT_READING_PREFS,
  READING_KEYS,
  READING_PREFS_KEY,
  isStep,
  parseReadingPrefs,
  readingAttribute,
  sanitizeReadingPrefs,
  serializeReadingPrefs,
  type ReadingPrefKey,
  type ReadingPrefs,
} from "./model";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type RootLike = Pick<HTMLElement, "setAttribute">;

export interface ReadingStore {
  get(): ReadingPrefs;
  set<K extends ReadingPrefKey>(key: K, value: ReadingPrefs[K]): ReadingPrefs;
  reset(): ReadingPrefs;
  subscribe(listener: (prefs: ReadingPrefs) => void): () => void;
}

export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultRoot(): RootLike | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function loadReadingPrefs(storage: Pick<Storage, "getItem"> | null = defaultStorage()): ReadingPrefs {
  try {
    return parseReadingPrefs(storage?.getItem(READING_PREFS_KEY));
  } catch {
    return { ...DEFAULT_READING_PREFS };
  }
}

export function saveReadingPrefs(prefs: ReadingPrefs, storage: Pick<Storage, "setItem"> | null = defaultStorage()): boolean {
  try {
    storage?.setItem(READING_PREFS_KEY, serializeReadingPrefs(prefs));
    return storage != null;
  } catch {
    return false;
  }
}

/** Writes data-reading-* on <html> (one attribute per field, default included; the style rules ignore "standard"). */
export function applyReadingPrefs(prefs: ReadingPrefs, root: RootLike | null = defaultRoot()): void {
  if (!root) return;
  const clean = sanitizeReadingPrefs(prefs);
  for (const key of READING_KEYS) root.setAttribute(readingAttribute(key), clean[key]);
}

export function createReadingStore(storage: StorageLike | null = defaultStorage(), root: RootLike | null = defaultRoot()): ReadingStore {
  let current = loadReadingPrefs(storage);
  const listeners = new Set<(prefs: ReadingPrefs) => void>();
  applyReadingPrefs(current, root);

  const commit = (next: ReadingPrefs): ReadingPrefs => {
    current = next;
    applyReadingPrefs(current, root);
    saveReadingPrefs(current, storage);
    for (const listener of [...listeners]) listener(current);
    return current;
  };

  return {
    get: () => current,
    set(key, value) {
      // A value outside the closed set is refused: the preferences stay as they are.
      return isStep(key, value) ? commit({ ...current, [key]: value }) : current;
    },
    reset: () => commit({ ...DEFAULT_READING_PREFS }),
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
