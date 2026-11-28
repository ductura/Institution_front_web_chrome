/**
 * What the student marked "nije greška" (E§3.5 review2, `S.hintOff`): the keys
 * of single findings, kept per work in this browser only, as the spelling
 * does. Neither the list nor the marking reaches the document or the server.
 */

import { CHECK_IDS, type CheckId, type Finding } from "./checks";

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

// ED-123 (prototype review2.js r2Kind): a whole kind switched off is kept among the same keys as `kind:<id>`,
// as the prototype keeps it in `S.hintOff`. A finding's key is `<kind>|<excerpt>`, so the two never meet.
// A mark left for later ("hole") is required and cannot be switched off.
const KIND = "kind:";

export const canSwitchOff = (kind: CheckId): boolean => kind !== "hole";

/** The kinds switched off, in the order of the checks. */
export const kindsOff = (keys: readonly string[]): CheckId[] =>
  CHECK_IDS.filter((kind) => canSwitchOff(kind) && keys.includes(KIND + kind));

/** Switches a kind off, or on again when it is off. */
export function toggleKind(keys: readonly string[], kind: CheckId): string[] {
  if (!canSwitchOff(kind)) return [...keys];
  return keys.includes(KIND + kind) ? restore(keys, KIND + kind) : ignore(keys, KIND + kind);
}

/**
 * Findings the student has not marked, and those marked, each in document order. Findings of a kind switched
 * off are in neither list: the kind comes back as a whole, from the line of kinds switched off.
 */
export function splitIgnored(findings: readonly Finding[], keys: readonly string[]): { open: Finding[]; ignored: Finding[] } {
  const marked = new Set(keys);
  const off = new Set<CheckId>(kindsOff(keys));
  const reported = findings.filter((f) => !off.has(f.kind));
  return { open: reported.filter((f) => !marked.has(f.key)), ignored: reported.filter((f) => marked.has(f.key)) };
}

/** How many open findings each kind has, for the kinds that can be switched off, in the order of the checks. */
export function kindCounts(findings: readonly Finding[]): { kind: CheckId; n: number }[] {
  return CHECK_IDS.filter(canSwitchOff)
    .map((kind) => ({ kind, n: findings.filter((f) => f.kind === kind).length }))
    .filter((row) => row.n > 0);
}
