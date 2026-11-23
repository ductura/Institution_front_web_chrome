/**
 * Comment anchors over the document of the teacher's live view (DAN-86 step
 * 2c; anchors: BACKEND 4.11, src/domain/collaboration/anchor.ts). The view
 * renders a CanonicalDocument, not an editor, so the text of a block is the
 * concatenation of its inline texts and offsets count UTF-16 code units, as
 * `createTextAnchor` and `resolveTextAnchor` do.
 */

import {
  ANCHOR_QUOTE_MAX, createTextAnchor, isTextAnchorInput, resolveTextAnchor, type TextAnchor,
} from "@/domain/collaboration";
import type {
  CanonicalDocument, CanonicalDocumentV3, DocumentNode, DocumentNodeV3, InlineNodeV3, Mark, NodeId,
} from "@/domain/document";

export type TextRange = { readonly nodeId: NodeId; readonly start: number; readonly end: number };

/** The document of the live view: v1, or v3 with its atoms (INT-26). */
export type LiveTextDocument = CanonicalDocument | CanonicalDocumentV3;
/** One block of it; v3 has the same four block types, only its inline children differ. */
export type LiveBlock = DocumentNode | DocumentNodeV3;
/** An inline node of v3 that is not text: a footnote, a citation or a cross reference. */
export type LiveAtom = Exclude<InlineNodeV3, { type: "text" }>;

const inlines = (node: LiveBlock): readonly InlineNodeV3[] => node.children;

/**
 * The text of a block: its text nodes only (INT-26). An atom is no part of
 * it, so an anchor counts the same characters in v1 and v3, and the label the
 * view draws for an atom never moves one. For v1 this is every child.
 */
export const blockText = (node: LiveBlock): string =>
  inlines(node).map((child) => (child.type === "text" ? child.text : "")).join("");

/**
 * The anchor for a selection inside one block, or null when it cannot be a
 * valid anchor: another block, an empty or blank selection, more than
 * ANCHOR_QUOTE_MAX code points. Surrounding white space is left out of the quote.
 */
export function anchorForSelection(
  doc: LiveTextDocument, nodeId: string, start: number, end: number,
): TextAnchor | null {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const text = blockText(node);
  let from = Math.min(start, end);
  let to = Math.max(start, end);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to > text.length) return null;
  while (from < to && /\s/u.test(text[from]!)) from += 1;
  while (to > from && /\s/u.test(text[to - 1]!)) to -= 1;
  if (from === to || [...text.slice(from, to)].length > ANCHOR_QUOTE_MAX) return null;
  const anchor = createTextAnchor({ nodeId: node.id, nodeText: text, start: from, end: to });
  return isTextAnchorInput(anchor) ? anchor : null;
}

/**
 * Where an anchor stands in the document now: only `exact` and `moved` give a
 * place; anything else is no place, never a guessed one (attack 7).
 */
export function placeAnchor(doc: LiveTextDocument | null, anchor: TextAnchor | null): TextRange | null {
  if (!doc || !anchor) return null;
  const node = doc.nodes.find((n) => n.id === anchor.nodeId);
  if (!node) return null;
  const found = resolveTextAnchor(anchor, node.id, blockText(node));
  return found.status === "exact" || found.status === "moved" ? { nodeId: node.id, start: found.start, end: found.end } : null;
}

/**
 * Each thread with its place in `doc`. Before any text has been shown (`doc`
 * null: still loading, nothing sent yet, or the connection retrying before a
 * first text) a thread is `pending`, not lost: there is nothing to look in, so
 * saying the place cannot be found would be untrue.
 */
export function placeThreads<T extends { readonly anchor: TextAnchor | null }>(
  doc: LiveTextDocument | null, threads: readonly T[],
): { thread: T; range: TextRange | null; pending: boolean }[] {
  return threads.map((thread) => ({ thread, range: placeAnchor(doc, thread.anchor), pending: doc === null }));
}

export type TextSegment = { readonly text: string; readonly marks: readonly Mark[]; readonly marked: boolean };
/** An atom of a v3 block in its place among the texts; it takes no offset (INT-26). */
export type AtomSegment = { readonly atom: LiveAtom };
export type Segment = TextSegment | AtomSegment;

/**
 * The inline texts of a block cut at the edges of `ranges`, each piece saying
 * whether it lies in one of them. Joined, the text pieces are the block's
 * text, so marking a comment never changes what is shown. A v3 atom stands
 * between them as its own segment and is never marked.
 */
export function blockSegments(node: DocumentNode, ranges: readonly { start: number; end: number }[]): TextSegment[];
export function blockSegments(node: LiveBlock, ranges: readonly { start: number; end: number }[]): Segment[];
export function blockSegments(node: LiveBlock, ranges: readonly { start: number; end: number }[]): Segment[] {
  const inRange = (at: number) => ranges.some((r) => r.start <= at && at < r.end);
  const cuts = new Set(ranges.flatMap((r) => [r.start, r.end]));
  const out: Segment[] = [];
  let at = 0;
  for (const child of inlines(node)) {
    if (child.type !== "text") {
      out.push({ atom: child });
      continue;
    }
    let piece = "";
    let marked = inRange(at);
    for (const ch of child.text) {
      if (piece !== "" && (cuts.has(at) || inRange(at) !== marked)) {
        out.push({ text: piece, marks: child.marks, marked });
        piece = "";
        marked = inRange(at);
      }
      piece += ch;
      at += ch.length;
    }
    if (piece !== "") out.push({ text: piece, marks: child.marks, marked });
  }
  return out;
}

