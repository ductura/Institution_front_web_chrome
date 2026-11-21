/**
 * The table of contents and the heading numbers (WEB-1602, plan M5.3, DAN-395).
 *
 * Nothing here numbers a heading: every number is read from the one chapter
 * projection, `deriveChapters`, keyed by the heading's stable block id. Chapter
 * scope (M5.8), the Draft panel (M5.14), the form check (M4.4) and the export
 * read the same projection, so the number in the editor, in the table of
 * contents and in the exported work is one and the same. Pure functions.
 */

import {
  deriveChapters,
  NEUTRAL_CHAPTER_PROFILE,
  type Chapter,
  type ChapterProfile,
  type HeadingLevel,
  type NodeId,
  type VersionedDocument,
} from "../document/document";

/** One line of the table of contents. */
export type TocEntry = {
  /** The heading's block id: stays the same when the chapter moves. */
  readonly blockId: NodeId;
  readonly level: HeadingLevel;
  /** "1", "1.1", "1.0.1" from the profile; never typed by the student. */
  readonly number: string;
  /** The heading's text, trimmed; "" for an empty heading. */
  readonly title: string;
  readonly parentId: NodeId | null;
};

function entryOf(chapter: Chapter): TocEntry {
  return {
    blockId: chapter.blockId,
    level: chapter.level,
    number: chapter.number,
    title: chapter.title,
    parentId: chapter.parentId,
  };
}

/** Every heading of the document as a line of the table of contents, in document order. */
export function tableOfContents(
  document: VersionedDocument,
  profile: ChapterProfile = NEUTRAL_CHAPTER_PROFILE,
): TocEntry[] {
  return deriveChapters(document, profile).chapters.map(entryOf);
}

/**
 * The plain text of the table of contents ("Kopiraj sadržaj rada"): one line
 * per heading, indented two spaces per level below the first. An empty heading
 * takes `untitled`.
 */
export function tocText(
  entries: readonly { readonly level: number; readonly number: string; readonly title: string }[],
  untitled: string,
): string {
  return entries
    .map((e) => `${"  ".repeat(Math.max(0, e.level - 1))}${e.number}. ${e.title === "" ? untitled : e.title}`)
    .join("\n");
}

/**
 * The heading numbers of a work as a list of `[blockId, number]` pairs in
 * document order. This is the shape the export equality test compares (SRV-1512):
 * the server's export snapshot and DOCX must carry exactly these pairs.
 */
export type ChapterNumberVector = readonly (readonly [blockId: string, number: string])[];

export function chapterNumberVector(
  document: VersionedDocument,
  profile: ChapterProfile = NEUTRAL_CHAPTER_PROFILE,
): ChapterNumberVector {
  return deriveChapters(document, profile).chapters.map((c) => [c.blockId, c.number] as const);
}

export type ChapterNumberMismatch =
  | { readonly kind: "number"; readonly blockId: string; readonly expected: string; readonly actual: string }
  | { readonly kind: "missing"; readonly blockId: string; readonly expected: string }
  | { readonly kind: "extra"; readonly blockId: string; readonly actual: string }
  | { readonly kind: "order"; readonly index: number; readonly expected: string; readonly actual: string };

/**
 * Compares the numbers another rendering carries (the export, a stored
 * snapshot) with the projection's. Equal only when both list the same headings
 * in the same order with the same numbers.
 */
export function compareChapterNumbers(
  expected: ChapterNumberVector,
  actual: ChapterNumberVector,
): { readonly equal: boolean; readonly mismatches: readonly ChapterNumberMismatch[] } {
  const mismatches: ChapterNumberMismatch[] = [];
  const actualById = new Map(actual.map(([id, n]) => [id, n]));
  const expectedById = new Map(expected.map(([id, n]) => [id, n]));
  for (const [id, number] of expected) {
    const found = actualById.get(id);
    if (found === undefined) mismatches.push({ kind: "missing", blockId: id, expected: number });
    else if (found !== number) mismatches.push({ kind: "number", blockId: id, expected: number, actual: found });
  }
  for (const [id, number] of actual) {
    if (!expectedById.has(id)) mismatches.push({ kind: "extra", blockId: id, actual: number });
  }
  if (mismatches.length === 0) {
    expected.forEach(([id], index) => {
      const other = actual[index]?.[0];
      if (other !== id) mismatches.push({ kind: "order", index, expected: id, actual: other ?? "" });
    });
  }
  return { equal: mismatches.length === 0, mismatches };
}
