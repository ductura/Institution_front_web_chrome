/**
 * What the panel shows of the tree (DAN-977, 977-3): which branches are
 * collapsed, and which row carries the active-chapter mark. Pure, so it is
 * tested without a DOM.
 */
import type { OutlineNode, OutlineRow } from "./outline-tree";

function* walk(nodes: readonly OutlineNode[], path: readonly OutlineNode[] = []): Generator<readonly OutlineNode[]> {
  for (const node of nodes) {
    const here = [...path, node];
    yield here;
    yield* walk(node.children, here);
  }
}

/** The indexes that can collapse: shown rows with children. Anything else is ignored. */
export function collapsedSet(tree: readonly OutlineNode[], indexes: readonly number[]): ReadonlySet<number> {
  const wanted = new Set(indexes);
  const set = new Set<number>();
  for (const path of walk(tree)) {
    const node = path[path.length - 1]!;
    if (node.children.length > 0 && wanted.has(node.index)) set.add(node.index);
  }
  return set;
}

/**
 * The row that carries the mark for `active` (an index into `rows`, as Ductus
 * `currentHeading` gives it), or -1. A row the panel leaves out belongs to the
 * nearest earlier shown row; inside a collapsed branch, the highest collapsed
 * ancestor carries the mark, as the one visible row on that path.
 */
export function activeRow(
  tree: readonly OutlineNode[], rows: readonly OutlineRow[], active: number, collapsed: ReadonlySet<number>,
): number {
  if (!Number.isInteger(active) || active < 0 || active >= rows.length) return -1;
  let found: readonly OutlineNode[] = [];
  for (const path of walk(tree)) {
    if (path[path.length - 1]!.index > active) break;
    found = path;
  }
  const hiding = found.find((node) => collapsed.has(node.index));
  return (hiding ?? found[found.length - 1])?.index ?? -1;
}
