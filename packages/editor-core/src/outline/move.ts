/**
 * Moving a chapter up or down (WEB-1602, plan M5.3; prototype "Struktura" ↑/↓
 * and Alt+Shift+↑/↓). A chapter is its heading, its own blocks and every
 * deeper chapter under it; it swaps places with the neighbouring chapter of the
 * same level under the same parent. Blocks are reordered, never rebuilt, so
 * every block keeps its id and the numbers follow from the projection again.
 * Pure: the same plan drives the canonical document and the editor.
 */

import {
  deriveChapters,
  type DocumentNode,
  type VersionedDocument,
} from "../document/document";

export type MoveDirection = "up" | "down";

/** A heading as the plan reads it: the index of its block and its level. */
export type PlanHeading = { readonly block: number; readonly level: number };

/**
 * The blocks `[start, end)` are replaced by the same blocks in `order` (block
 * indices of the old order). `moved` is the new index of the moved heading.
 * The same move as a cut and an insert: the chapter's blocks
 * `[chapterFrom, chapterTo)` go in front of old block `insertAt` (or to the
 * end of the range when `insertAt` is `end`); every other block stays put.
 */
export type ChapterMovePlan = {
  readonly start: number;
  readonly end: number;
  readonly order: readonly number[];
  readonly moved: number;
  readonly chapterFrom: number;
  readonly chapterTo: number;
  readonly insertAt: number;
};

/** Index (in `headings`) of the first heading after `i` that ends chapter `i`. */
function subtreeEnd(headings: readonly PlanHeading[], i: number): number {
  const level = headings[i]!.level;
  let j = i + 1;
  while (j < headings.length && headings[j]!.level > level) j += 1;
  return j;
}

function blockOf(headings: readonly PlanHeading[], i: number, blockCount: number): number {
  return i < headings.length ? headings[i]!.block : blockCount;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i += 1) out.push(i);
  return out;
}

/**
 * The move of the chapter whose heading is `headings[index]`, or null when it
 * has no neighbour of its level that way (first or last under its parent, or
 * the neighbour is of another level).
 */
export function planChapterMove(
  headings: readonly PlanHeading[],
  blockCount: number,
  index: number,
  direction: MoveDirection,
): ChapterMovePlan | null {
  const self = headings[index];
  if (!self) return null;
  const selfEnd = subtreeEnd(headings, index);
  if (direction === "up") {
    let k = index - 1;
    while (k >= 0 && headings[k]!.level > self.level) k -= 1;
    if (k < 0 || headings[k]!.level !== self.level) return null;
    const start = headings[k]!.block;
    const end = blockOf(headings, selfEnd, blockCount);
    const order = [...range(self.block, end), ...range(start, self.block)];
    return { start, end, order, moved: start, chapterFrom: self.block, chapterTo: end, insertAt: start };
  }
  if (selfEnd >= headings.length || headings[selfEnd]!.level !== self.level) return null;
  const next = headings[selfEnd]!.block;
  const end = blockOf(headings, subtreeEnd(headings, selfEnd), blockCount);
  const order = [...range(next, end), ...range(self.block, next)];
  return { start: self.block, end, order, moved: self.block + (end - next), chapterFrom: self.block, chapterTo: next, insertAt: end };
}

/** The headings of a canonical document for the plan, read from the one projection. */
export function planHeadingsOf(document: VersionedDocument): PlanHeading[] {
  const index = new Map<string, number>();
  document.nodes.forEach((node, i) => index.set(node.id, i));
  return deriveChapters(document).chapters.map((c) => ({ block: index.get(c.blockId)!, level: c.level }));
}

/**
 * The document with the chapter of heading `blockId` moved, or null when it
 * cannot move that way or no such heading exists. The same node objects in a
 * new order: no id changes, nothing is copied.
 */
export function moveChapter<D extends VersionedDocument>(document: D, blockId: string, direction: MoveDirection): D | null {
  const headings = planHeadingsOf(document);
  const index = headings.findIndex((h) => document.nodes[h.block]!.id === blockId);
  if (index < 0) return null;
  const plan = planChapterMove(headings, document.nodes.length, index, direction);
  if (!plan) return null;
  const nodes = document.nodes as readonly DocumentNode[];
  const moved = [...nodes.slice(0, plan.start), ...plan.order.map((i) => nodes[i]!), ...nodes.slice(plan.end)];
  return { ...document, nodes: moved } as D;
}
