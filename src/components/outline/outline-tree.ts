/**
 * The chapter tree of the left panel (DAN-977, 977-1): a pure function over the
 * flat heading list, so the panel and its tests need no editor and no DOM.
 */

/** Mirror of Ductus `src/editor/outline.ts` OutlineEntry; the editor fills it. */
export type OutlineEntry = {
  /** The block id from the identity plugin, or null before it is minted. */
  readonly id: string | null;
  readonly level: number;
  /** The heading's text, trimmed; "" for an empty heading. */
  readonly text: string;
  /** Document position of the heading node. */
  readonly pos: number;
};

/** One heading with the number editor-core gave it ("2.1.3"); null when it has none. */
export type OutlineRow = { readonly entry: OutlineEntry; readonly number: string | null };

export type OutlineNode = {
  readonly row: OutlineRow;
  /** Position of the row in the input. */
  readonly index: number;
  readonly number: string | null;
  /** 1 for a root; one more than the parent. */
  readonly depth: number;
  readonly children: OutlineNode[];
};

/** The panel shows three heading levels. */
export const OUTLINE_LEVELS = 3;

const shown = (level: number) => Number.isInteger(level) && level >= 1 && level <= OUTLINE_LEVELS;

/**
 * Nests every heading of level 1 to 3 under the nearest earlier heading of a
 * lower level; a heading with none is a root. Other levels are left out. The
 * input is read only, and ids are never used as keys, so duplicates and names
 * like `__proto__` change nothing.
 */
export function outlineTree(rows: readonly OutlineRow[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const open: OutlineNode[] = [];
  for (const [index, row] of rows.entries()) {
    const { level } = row.entry;
    if (!shown(level)) continue;
    while (open.length > 0 && open[open.length - 1]!.row.entry.level >= level) open.pop();
    const parent = open[open.length - 1];
    const node: OutlineNode = { row, index, number: row.number, depth: parent ? parent.depth + 1 : 1, children: [] };
    (parent ? parent.children : roots).push(node);
    open.push(node);
  }
  return roots;
}
