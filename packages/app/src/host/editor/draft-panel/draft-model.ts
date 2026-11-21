// WEB-1609 (M5.14a-c, D-234): the Draft panel as data. The chapters come from
// the one projection (editor-core/outline, by block id); the panel numbers
// nothing itself. A move reorders whole chapters through the editor, so no
// block id changes. A chapter note lives beside the work, keyed by the heading's
// block id, and is never written into the document or the export.
import type { EditorTocEntry, MoveDirection } from "../../../../../editor-core/src/outline/index.ts";

export const MAX_NOTE_LENGTH = 2000;

export type DraftRow = {
  readonly key: string;
  readonly number: string;
  readonly title: string;
  readonly level: number;
  readonly hasNote: boolean;
};

export function draftRows(entries: readonly EditorTocEntry[], notes: ChapterNotes): DraftRow[] {
  return entries.map((e) => ({ key: e.key, number: e.number, title: e.title, level: e.level, hasNote: (notes[e.key] ?? "") !== "" }));
}

/** Keys of the chapters that share a parent and a level with `key`, in document order. */
export function siblingKeys(entries: readonly { readonly key: string; readonly level: number }[], key: string): string[] {
  const at = entries.findIndex((e) => e.key === key);
  if (at < 0) return [];
  const level = entries[at]!.level;
  let from = at;
  while (from > 0 && entries[from - 1]!.level >= level) from -= 1;
  let to = at;
  while (to + 1 < entries.length && entries[to + 1]!.level >= level) to += 1;
  return entries.slice(from, to + 1).filter((e) => e.level === level).map((e) => e.key);
}

/**
 * The swaps that carry chapter `from` to the place of chapter `to`: only
 * between siblings (same level, same parent). Empty when the drop is not allowed.
 */
export function dragSteps(
  entries: readonly { readonly key: string; readonly level: number }[],
  from: string,
  to: string,
): { direction: MoveDirection; times: number } | null {
  if (from === to) return null;
  const sibs = siblingKeys(entries, from);
  const a = sibs.indexOf(from);
  const b = sibs.indexOf(to);
  if (a < 0 || b < 0) return null;
  return { direction: b < a ? "up" : "down", times: Math.abs(b - a) };
}

export type ChapterNotes = Readonly<Record<string, string>>;

/** A note as stored: trimmed of control characters and cut to the limit. */
export function cleanNote(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "").slice(0, MAX_NOTE_LENGTH);
}

export function withNote(notes: ChapterNotes, key: string, text: string): ChapterNotes {
  const next = { ...notes };
  const clean = cleanNote(text);
  if (clean.trim() === "") delete next[key];
  else next[key] = clean;
  return next;
}

/** The notes of chapters that still exist; a note of a deleted heading is dropped. */
export function pruneNotes(notes: ChapterNotes, liveKeys: readonly string[]): ChapterNotes {
  const live = new Set(liveKeys);
  return Object.fromEntries(Object.entries(notes).filter(([k]) => live.has(k)));
}

export type NoteStorage = Pick<Storage, "getItem" | "setItem">;

export function noteStorageKey(workId: string): string {
  return `ductura.draft-notes.${workId}`;
}

/** Reads the notes of a work; anything malformed or unreadable is an empty set. */
export function loadNotes(storage: NoteStorage | null, workId: string): ChapterNotes {
  try {
    const raw = storage?.getItem(noteStorageKey(workId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string" && v !== "") out[k] = cleanNote(v);
    return out;
  } catch {
    return {};
  }
}

export function saveNotes(storage: NoteStorage | null, workId: string, notes: ChapterNotes): boolean {
  try {
    storage?.setItem(noteStorageKey(workId), JSON.stringify(notes));
    return storage != null;
  } catch {
    return false;
  }
}
