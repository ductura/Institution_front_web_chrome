// WEB-1608 (M5.V1): the numbers of a numbered list, derived and never stored.
// The editor draws them and the export writes them from this one function, so
// the two always agree ("1.", "1.1.", "1.1.1.").

export type ListLevel = 1 | 2 | 3;

export const MAX_LIST_LEVEL: ListLevel = 3;

/** A block as far as numbering is concerned: only a numbered item has a level. */
export type NumberingBlock = { type: string; level?: number };

/**
 * One number per block in order: the label of a numbered item ("2.1."), `null`
 * for every other block. A run of numbered items is one list; any other block
 * (a paragraph, a bullet item, a heading) ends it, so the next item starts at
 * "1." again. An item deeper than the one before it (level 3 right after
 * level 1) counts as one level deeper, so the numbers never skip a level.
 */
export function numberedListNumbers(blocks: readonly NumberingBlock[]): (string | null)[] {
  const counters: number[] = [];
  let previous = 0;
  return blocks.map((block) => {
    if (block.type !== "numberedItem") {
      counters.length = 0;
      previous = 0;
      return null;
    }
    const wanted = Math.min(MAX_LIST_LEVEL, Math.max(1, Math.trunc(block.level ?? 1)));
    const level = Math.min(wanted, previous + 1);
    counters.length = level;
    for (let i = 0; i < level; i++) counters[i] = counters[i] ?? 0;
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;
    previous = level;
    return `${counters.join(".")}.`;
  });
}
