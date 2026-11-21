/** Logic of the editor toolbar, outline and progress (M5.2, DAN-211, DAN-214), apart from React. */

import { toolbarIndex } from "../object-toolbar/toolbar-logic";

export { toolbarIndex };

/** A block of the document as the host reads it: its kind and plain text. */
export type ProgressBlock = { readonly kind: string; readonly text: string };

/** Kinds that never count towards the length of the work (footnotes, M5.2). */
const UNCOUNTED_KINDS: ReadonlySet<string> = new Set(["footnote", "footnotes", "fusnota"]);

/** Words of the blocks, footnotes left out. */
export function bodyWordCount(blocks: readonly ProgressBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    if (UNCOUNTED_KINDS.has(block.kind)) continue;
    for (const word of block.text.split(/\s+/u)) if (word.length > 0) total += 1;
  }
  return total;
}

/** The assignment's inclusive word limits; either end may be absent. */
export type WordRange = { readonly min: number | null; readonly max: number | null };

export type ProgressStatus = "noRange" | "below" | "within" | "above";

export type Progress = {
  words: number;
  status: ProgressStatus;
  /** 0..1, towards the lower limit (or the upper one when only that is given); 1 once reached. */
  fraction: number;
  /** The limit the bar measures against; null without a range. */
  target: number | null;
};

export function progressOf(words: number, range: WordRange | null): Progress {
  const min = range?.min ?? null;
  const max = range?.max ?? null;
  const safe = Math.max(0, Math.trunc(words));
  const target = min ?? max;
  if (target === null || target <= 0) return { words: safe, status: "noRange", fraction: 0, target: null };
  const status: ProgressStatus = min !== null && safe < min ? "below" : max !== null && safe > max ? "above" : "within";
  return { words: safe, status, fraction: Math.min(1, safe / target), target };
}

/** "2 000": thousands grouped with a no-break space. */
export function groupWords(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "2 000–2 500", "od 2 000", "do 2 500"; empty without a range. */
export function rangeText(range: WordRange | null): string {
  const min = range?.min ?? null;
  const max = range?.max ?? null;
  if (min !== null && max !== null) return `${groupWords(min)}–${groupWords(max)}`;
  if (min !== null) return `od ${groupWords(min)}`;
  if (max !== null) return `do ${groupWords(max)}`;
  return "";
}
