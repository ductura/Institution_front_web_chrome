/**
 * ED-102 (prototype toolbar2.js menu-marks, tbMarkAdd, tbMarkGo, tbMarkDel; INVENTAR-editor 1293, 1368): "Oznake",
 * a paragraph the student marks to come back to. A bookmark holds the paragraph's block id, so it follows the
 * paragraph through edits, and is kept only in this browser ("Vidite ih samo Vi").
 */
import type { Node as PmNode } from "@tiptap/pm/model";

import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";

export type Bookmark = { readonly id: string; readonly block: string; readonly label: string; readonly where: string };
export type PlacedBookmark = Bookmark & { readonly pos: number };

const LABEL = 34;
const cut = (text: string, n: number) => { const t = text.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

/** The top-level block holding `pos`, with the heading of its chapter; null for a block without an id. */
export function blockAt(doc: PmNode, pos: number): { block: string; pos: number; label: string; where: string } | null {
  let chapter = "";
  for (let i = 0, offset = 0; i < doc.childCount; offset += doc.child(i).nodeSize, i += 1) {
    const node = doc.child(i);
    if (node.type.name === "heading" && node.attrs.level <= 2) chapter = node.textContent;
    if (pos < offset || pos > offset + node.nodeSize) continue;
    const block = node.attrs[NODE_ID_ATTRIBUTE];
    return typeof block === "string" && block ? { block, pos: offset, label: cut(node.textContent, LABEL), where: cut(chapter, 40) } : null;
  }
  return null;
}

/** Adds the paragraph at `pos`; "already" when it is marked, "none" when there is no block to mark. */
export function addBookmark(marks: readonly Bookmark[], doc: PmNode, pos: number, id: string):
  { marks: Bookmark[]; result: "added" | "already" | "none" } {
  const at = blockAt(doc, pos);
  if (!at) return { marks: [...marks], result: "none" };
  if (marks.some((m) => m.block === at.block)) return { marks: [...marks], result: "already" };
  return { marks: [...marks, { id, block: at.block, label: at.label, where: at.where }], result: "added" };
}

export const removeBookmark = (marks: readonly Bookmark[], id: string): Bookmark[] => marks.filter((m) => m.id !== id);

/** The bookmarks whose paragraph is still in the text, in the text's order. */
export function placeBookmarks(marks: readonly Bookmark[], doc: PmNode): PlacedBookmark[] {
  const at = new Map<string, number>();
  doc.forEach((node, offset) => { const id = node.attrs[NODE_ID_ATTRIBUTE]; if (typeof id === "string") at.set(id, offset); });
  return marks.flatMap((m) => (at.has(m.block) ? [{ ...m, pos: at.get(m.block)! }] : [])).sort((a, b) => a.pos - b.pos);
}

const KEY = (work: string) => `ductus:bookmarks:${work}`;

export function loadBookmarks(work: string, store: Pick<Storage, "getItem"> | null): Bookmark[] {
  try {
    const raw = store?.getItem(KEY(work));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((m): m is Bookmark =>
      !!m && typeof m.id === "string" && typeof m.block === "string" && typeof m.label === "string" && typeof m.where === "string") : [];
  } catch { return []; }
}

export function saveBookmarks(work: string, marks: readonly Bookmark[], store: Pick<Storage, "setItem" | "removeItem"> | null): void {
  try { if (marks.length) store?.setItem(KEY(work), JSON.stringify(marks)); else store?.removeItem(KEY(work)); } catch { /* storage off */ }
}
