/**
 * What the student marked "nije greška" (E§3.5 review2, `S.hintOff`): the keys
 * of single findings, kept per work in this browser only, as the spelling
 * does. Neither the list nor the marking reaches the document or the server.
 */

import type { Finding } from "./checks";

const KEY = "ductura.pregled.zanemareno.v1.";
const MAX = 2000;

type ReadStorage = Pick<Storage, "getItem"> | null;
type WriteStorage = Pick<Storage, "setItem"> | null;

export function readIgnored(storage: ReadStorage, workId: string): string[] {
  try {
    const raw = storage?.getItem(KEY + workId);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value)
      ? [...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length < 200))].slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function writeIgnored(storage: WriteStorage, workId: string, keys: readonly string[]): void {
  try { storage?.setItem(KEY + workId, JSON.stringify([...new Set(keys)].slice(0, MAX))); } catch { /* private window or full: still works for this page */ }
}

export const ignore = (keys: readonly string[], key: string): string[] => (keys.includes(key) ? [...keys] : [...keys, key]);
export const restore = (keys: readonly string[], key: string): string[] => keys.filter((k) => k !== key);

/** Findings the student has not marked, and those marked, each in document order. */
export function splitIgnored(findings: readonly Finding[], keys: readonly string[]): { open: Finding[]; ignored: Finding[] } {
  const marked = new Set(keys);
  return { open: findings.filter((f) => !marked.has(f.key)), ignored: findings.filter((f) => marked.has(f.key)) };
}
