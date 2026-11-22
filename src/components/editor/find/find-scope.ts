import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** The prototype's three scopes of "Traži" (`#findScope`). */
export type FindScope = "all" | "chap" | "quote";

/**
 * The range of the chapter that holds `pos`: from the heading of level 1 or 2
 * at or before it to the next such heading (or the end). Before the first
 * heading the chapter starts at the beginning of the document.
 */
export function chapterRange(doc: ProseMirrorNode, pos: number): { from: number; to: number } {
  let from = 0;
  let to = doc.content.size;
  let offset = 0;
  let after = false;
  doc.forEach((node) => {
    const start = offset;
    offset += node.nodeSize;
    if (node.type.name !== "heading" || Number(node.attrs.level) > 2) return;
    if (start <= pos) from = start;
    else if (!after) {
      to = start;
      after = true;
    }
  });
  return { from, to };
}

/** Keeps the matches a scope allows. `inQuote` says whether a match lies in a source quote. */
export function inScope<M extends { from: number; to: number }>(
  matches: readonly M[],
  scope: FindScope,
  range: { from: number; to: number },
  inQuote: (match: M) => boolean,
): M[] {
  if (scope === "quote") return matches.filter(inQuote);
  if (scope === "chap") return matches.filter((m) => m.from >= range.from && m.to <= range.to);
  return [...matches];
}
