// WEB-2128: the three-step start of a work: kind, question, skeleton (plus.js
// wizOpen/wizMake). The skeleton is plain data; putting it into the editor is
// the caller's job, so the wizard never writes into a work by itself.
import { assistHr as t, type KindKey } from "./messages.hr";

export const KIND_KEYS = ["emp", "slucaj", "pregled", "esej"] as const satisfies readonly KindKey[];
export const DEFAULT_KIND: KindKey = "slucaj";
export const MAX_CHAPTERS = 12;
export const MAX_TITLE = 160;

export type Skeleton = { readonly title: string; readonly question: string; readonly chapters: readonly string[] };

export const chaptersOfKind = (kind: KindKey): readonly string[] => t.wizard.kinds[kind].chapters;

/** One chapter per line, empty lines dropped, titles cut to the limit. */
export function parseChapters(text: string): string[] {
  // eslint-disable-next-line no-control-regex
  return text.split("\n").map((l) => l.replace(/[\u0000-\u001f]/gu, " ").trim().slice(0, MAX_TITLE)).filter((l) => l !== "").slice(0, MAX_CHAPTERS);
}

export function makeSkeleton(title: string, question: string, chaptersText: string): Skeleton | null {
  const chapters = parseChapters(chaptersText);
  if (chapters.length === 0) return null;
  // eslint-disable-next-line no-control-regex
  return { title: title.replace(/[\u0000-\u001f]/gu, " ").trim().slice(0, MAX_TITLE), question: question.trim().slice(0, 600), chapters };
}

/** A work that already has chapters is never overwritten by the wizard. */
export const wizardAllowed = (chapterCount: number) => chapterCount === 0;
