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
 * `currentHeading` gives it), or -1. The path to it is read from `full`, the
 * whole tree; a row the panel leaves out belongs to the nearest earlier shown
 * row. On that path, the mark goes to the highest collapsed node, else to the
 * deepest node `tree` shows (`tree` may be filtered by a search, 978-1).
 */
export function activeRow(
  tree: readonly OutlineNode[], rows: readonly OutlineRow[], active: number, collapsed: ReadonlySet<number>,
  full: readonly OutlineNode[] = tree,
): number {
  if (!Number.isInteger(active) || active < 0 || active >= rows.length) return -1;
  let found: readonly OutlineNode[] = [];
  for (const path of walk(full)) {
    if (path[path.length - 1]!.index > active) break;
    found = path;
  }
  const shown = new Set<number>();
  for (const path of walk(tree)) shown.add(path[path.length - 1]!.index);
  // A filtered tree keeps every ancestor of what it shows, so this is a prefix of the path.
  const visible = found.filter((node) => shown.has(node.index));
  const hiding = visible.find((node) => collapsed.has(node.index));
  return (hiding ?? visible[visible.length - 1])?.index ?? -1;
}

/** Lower case without diacritics: Č, Ć → c, Š → s, Ž → z, Đ → d, Ǉ → lj (978-1). */
export function foldHr(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("đ", "d");
}

/** The longest query, in code points. */
export const SEARCH_MAX = 200;

/** A typed query, trimmed, cut to SEARCH_MAX code points and folded; "" means no filter. */
export function searchQuery(raw: string): string {
  return foldHr(Array.from(raw.trim()).slice(0, SEARCH_MAX).join(""));
}

/**
 * The tree cut to the headings whose folded title holds `query` (taken
 * literally), with all their ancestors. Nodes keep their index, number and
 * depth; only the child lists are new. An empty query returns the tree as is.
 */
export function filterTree(tree: readonly OutlineNode[], query: string): readonly OutlineNode[] {
  if (query === "") return tree;
  const cut = (nodes: readonly OutlineNode[]): OutlineNode[] => nodes.flatMap((node) => {
    const children = cut(node.children);
    return foldHr(node.row.entry.text).includes(query) || children.length > 0 ? [{ ...node, children }] : [];
  });
  return cut(tree);
}
