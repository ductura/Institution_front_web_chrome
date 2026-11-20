/**
 * "Sažetak rada na jednoj stranici" (E§3.5 review2 `r2digest`): the work as it
 * is now, made again from the document every time it changes, so the student
 * and the mentor read the same thing. Pure; the text is the view's.
 */

import type { Finding } from "./checks";
import { sentencesOf } from "./checks";
import { wordCount, type ReviewDoc } from "./model";

export type DigestRow = { readonly number: string; readonly title: string; readonly words: number; readonly citations: number };

export type Digest = {
  /** The first level 1 heading, or null. */
  readonly title: string | null;
  readonly words: number;
  readonly citations: number;
  readonly rows: readonly DigestRow[];
  /** H1, H2… marks found in the text, once each, in order. */
  readonly hypotheses: readonly string[];
  /** The first two sentences of the conclusion, or null when there is none. */
  readonly conclusion: string | null;
  /** Findings the student has not marked: all and the required ones. */
  readonly open: number;
  readonly openRequired: number;
};

const HYPOTHESIS = /(?<![\p{L}\d])H\d(?![\p{L}\d])/gu;
const CONCLUSION = /^zaklju[čc]ak|zaklju[čc]n[aeio]/iu;

export function digestOf(doc: ReviewDoc, open: readonly Finding[]): Digest {
  const rows: DigestRow[] = doc.chapters.map((chapter, i) => {
    // Only the blocks up to the next heading of any level: subchapters have rows of their own.
    const own = doc.blocks.slice(chapter.block + 1, doc.chapters[i + 1]?.block ?? doc.blocks.length);
    return {
      number: chapter.number, title: chapter.title,
      words: own.reduce((sum, block) => sum + wordCount(block.text), 0),
      citations: own.reduce((sum, block) => sum + block.citations, 0),
    };
  });
  const body = doc.blocks.filter((block) => block.kind !== "heading");
  const hypotheses = [...new Set(body.flatMap((block) => block.text.match(HYPOTHESIS) ?? []))];
  const conclusionAt = doc.chapters.find((chapter) => CONCLUSION.test(chapter.title));
  const conclusionText = conclusionAt
    ? doc.blocks.slice(conclusionAt.block + 1, conclusionAt.end).map((block) => block.text).join(" ").trim()
    : "";
  return {
    title: doc.chapters.find((chapter) => chapter.level === 1)?.title || null,
    words: body.reduce((sum, block) => sum + wordCount(block.text), 0),
    citations: body.reduce((sum, block) => sum + block.citations, 0),
    // A row counts the chapter's own text; a subchapter has a row of its own, so nothing is counted twice.
    rows: rows.filter((row) => row.title !== "" || row.words > 0),
    hypotheses,
    conclusion: conclusionText === "" ? null : sentencesOf(conclusionText).slice(0, 2).join(" ").replaceAll("￼", ""),
    open: open.length,
    openRequired: open.filter((finding) => finding.severity === "required").length,
  };
}
