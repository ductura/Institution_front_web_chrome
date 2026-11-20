/**
 * Browser-only spelling state, kept apart from the work (WEB-1104): the switch
 * and the student's own dictionary are one record for all works; the words
 * ignored "in this work" are a record per work. Neither is part of the
 * document or sent to the server (the prototype keeps them the same way).
 */

const KEY = "ductura.pravopis.v1";
const WORK_KEY = "ductura.pravopis.rad.v1.";
const MAX_WORDS = 5000;

export type StoredSpelling = { enabled: boolean; user: string[] };

const words = (v: unknown): string[] => Array.isArray(v)
  ? [...new Set(v.filter((w): w is string => typeof w === "string" && w.length > 0 && w.length < 100))].slice(0, MAX_WORDS) : [];

function read(storage: Pick<Storage, "getItem"> | null, key: string): unknown {
  try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(storage: Pick<Storage, "setItem"> | null, key: string, value: unknown): void {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* private window or full: the check still works for this page */ }
}

export function readSpelling(storage: Pick<Storage, "getItem"> | null): StoredSpelling {
  const v = read(storage, KEY) as { enabled?: unknown; user?: unknown } | null;
  return { enabled: typeof v?.enabled === "boolean" ? v.enabled : true, user: words(v?.user) };
}
export function writeSpelling(storage: Pick<Storage, "setItem"> | null, s: StoredSpelling): void {
  write(storage, KEY, { enabled: s.enabled, user: words(s.user) });
}
export function readWorkIgnored(storage: Pick<Storage, "getItem"> | null, workId: string): string[] {
  return words(read(storage, WORK_KEY + workId));
}
export function writeWorkIgnored(storage: Pick<Storage, "setItem"> | null, workId: string, list: readonly string[]): void {
  write(storage, WORK_KEY + workId, words([...list]));
}

export function browserStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
