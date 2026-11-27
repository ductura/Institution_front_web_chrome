// MEN-R12 (MEN-24): "Što je novo od zadnje sesije". The words of every chapter are kept on the device when the
// student leaves; the next visit compares them with the work as it is then. Device only, like the other notes.
import type { AssistChapter } from "./blocks";
import { notesKey, type NoteStorage } from "./work-notes";

export type Seen = Readonly<Record<string, number>>;
export type Change = { readonly chapter: AssistChapter; readonly kind: "added" | "grown" | "shrunk"; readonly delta: number };

export const seenKey = (workId: string) => `${notesKey(workId)}.seen`;

/** Null when nothing usable was kept (first visit or a broken store): then there is nothing to compare with. */
export function parseSeen(raw: string | null | undefined): Seen | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) out[k] = v;
  return out;
}

export const seenOf = (chapters: readonly AssistChapter[]): Seen => Object.fromEntries(chapters.map((c) => [c.id, c.words]));

export function loadSeen(storage: NoteStorage | null, workId: string): Seen | null {
  try { return parseSeen(storage?.getItem(seenKey(workId))); } catch { return null; }
}

export function saveSeen(storage: NoteStorage | null, workId: string, chapters: readonly AssistChapter[]): boolean {
  try { storage?.setItem(seenKey(workId), JSON.stringify(seenOf(chapters))); return storage != null; } catch { return false; }
}

/** What differs from the last visit, in document order. An empty new chapter counts as added; no earlier visit gives nothing. */
export function whatsNew(before: Seen | null, chapters: readonly AssistChapter[]): Change[] {
  if (before === null) return [];
  return chapters.flatMap((chapter): Change[] => {
    const was = before[chapter.id];
    if (was === undefined) return [{ chapter, kind: "added", delta: chapter.words }];
    const delta = chapter.words - was;
    return delta === 0 ? [] : [{ chapter, kind: delta > 0 ? "grown" : "shrunk", delta: Math.abs(delta) }];
  });
}
