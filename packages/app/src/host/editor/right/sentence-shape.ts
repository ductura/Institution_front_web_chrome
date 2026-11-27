// ED-73 (paritet, prototip features.js `bars`): "Oblik rečenica" in the group Pregled. One bar per sentence of
// the paragraph at the cursor, its width against the longest sentence of that paragraph; a sentence over 40 words
// is drawn in the warning colour. Only reads the text; nothing leaves the browser.
import { wordCount, type ReviewDoc } from "../../../../../../src/components/editor/review/model";
import { sentencesOf } from "../../../../../../src/components/editor/review/checks";

/** Longer than this many words, a sentence is marked (the prototype's `w > 40`). */
export const LONG_SENTENCE_WORDS = 40;

export type ShapeBar = {
  /** The sentence's place in the paragraph, from 0. */
  readonly index: number;
  readonly words: number;
  /** Width in whole percent of the longest sentence (1 to 100). */
  readonly width: number;
  readonly long: boolean;
};

/** The bars of one paragraph's text; empty when it has no sentence with a word. */
export function sentenceShape(text: string): ShapeBar[] {
  const counts = sentencesOf(text).map(wordCount).filter((n) => n > 0);
  const longest = Math.max(1, ...counts);
  return counts.map((words, index) => ({
    index, words, width: Math.max(1, Math.round((words / longest) * 100)), long: words > LONG_SENTENCE_WORDS,
  }));
}

/** The text of the block holding the cursor at `pos`; null before the first block. */
export function blockTextAt(doc: ReviewDoc, pos: number): string | null {
  let text: string | null = null;
  for (const block of doc.blocks) { if (block.pos <= pos) text = block.text; else break; }
  return text;
}
