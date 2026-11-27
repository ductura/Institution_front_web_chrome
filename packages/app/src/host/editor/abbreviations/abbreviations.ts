// ED-79: "Popis kratica" (prototype more2.js `abbrs`, `m2AbEdit`). The list is drawn from the text:
// an abbreviation is two to nine capitals or digits in brackets, and its full name is guessed from the
// words just before it whose initials spell it ("Europska unija (EU)"). The student may write or
// change a full name in the dialog "Kratica X"; that choice is kept in this browser for this person
// and work, like the work parts, and an empty name gives the guess back.

export type Abbreviation = {
  readonly abbreviation: string;
  /** The full name, written by the student or guessed from the text; "" when neither is known. */
  readonly full: string;
  /** True while the full name is the guess from the text (nothing written for it). */
  readonly guessed: boolean;
};

export type FullNames = Readonly<Record<string, string>>;

const SMALL = /^(i|u|o|a|na|za|od|do|iz|s|sa|te|ili|of|the|and|for|in|de|la)$/i;
const IN_BRACKETS = /\((\p{Lu}[\p{Lu}\d]{1,8})\)/gu;
const OPENING = /^[„"(]+/;

/** The guessed full name before position `at` of `text`, or "" (prototype: up to ten words back). */
function guessBefore(text: string, at: number, abbreviation: string): string {
  const words = text.slice(0, at).trim().split(/\s+/).slice(-10);
  const letters = abbreviation.replace(/\d/g, "");
  for (let k = 2; k <= words.length; k += 1) {
    const part = words.slice(-k);
    const initials = part.filter((w) => !SMALL.test(w)).map((w) => w.replace(OPENING, "")[0] ?? "").join("").toLocaleUpperCase("hr");
    if (initials === letters && !SMALL.test(part[0]!)) return part.join(" ").replace(OPENING, "").replace(/[,;:]+$/, "");
  }
  return "";
}

/** Every abbreviation in the text blocks, in Croatian alphabetical order, with its full name. */
export function listAbbreviations(blocks: readonly string[], written: FullNames = {}): readonly Abbreviation[] {
  const guesses = new Map<string, string>();
  for (const text of blocks) {
    for (const match of text.matchAll(IN_BRACKETS)) {
      const abbreviation = match[1]!;
      if (guesses.get(abbreviation)) continue;
      guesses.set(abbreviation, guessBefore(text, match.index, abbreviation));
    }
  }
  return [...guesses.entries()]
    .map(([abbreviation, guess]) => {
      const own = written[abbreviation];
      return own ? { abbreviation, full: own, guessed: false } : { abbreviation, full: guess, guessed: true };
    })
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation, "hr"));
}

// The full names the student wrote, per person and work, shared by the box and its dialog.
export type NamesStorage = Pick<Storage, "getItem" | "setItem">;

const PREFIX = "ductura.editor.abbreviations:";
const EMPTY: FullNames = {};
const known = new Map<string, FullNames>();
const listeners = new Set<() => void>();

/** The key for one person and one work. */
export const fullNamesKey = (scope: string, documentId: string) => `${PREFIX}${JSON.stringify([scope, documentId])}`;

const browserStorage = (): NamesStorage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/** What was written for `key`; the same object until it changes. */
export function readFullNames(key: string, storage: () => NamesStorage | null = browserStorage): FullNames {
  const held = known.get(key);
  if (held !== undefined) return held;
  let names: FullNames = EMPTY;
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(key) ?? "null");
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      names = Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== ""));
    }
  } catch { names = EMPTY; }
  known.set(key, names);
  return names;
}

/** Keeps the full name for one abbreviation; an empty one forgets it, so the guess comes back. */
export function writeFullName(key: string, abbreviation: string, full: string, storage: () => NamesStorage | null = browserStorage): FullNames {
  const { [abbreviation]: _old, ...rest } = readFullNames(key, storage);
  const name = full.trim();
  const next: FullNames = name === "" ? rest : { ...rest, [abbreviation]: name };
  known.set(key, next);
  try { storage()?.setItem(key, JSON.stringify(next)); } catch { /* kept for this page */ }
  for (const listener of listeners) listener();
  return next;
}

export function subscribeFullNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test seam: forgets what this page remembered. */
export function resetFullNamesForTest(): void {
  known.clear();
}
