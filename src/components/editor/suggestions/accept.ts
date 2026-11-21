/**
 * Acceptance of a suggestion: the one place a suggestion changes text, and the
 * student's own change. The anchor is resolved against the paragraph the
 * editor holds; only a place found exactly (or moved with the same quote) is
 * used, and the text there must still be the quoted text. Any doubt gives no
 * change (`missing`): the suggestion stays in the list, never at a guessed place.
 */

import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

import { resolveTextAnchor } from "../../../../packages/editor-core/src/document/collaboration";
import { NODE_ID_ATTRIBUTE } from "@/editor";

import { SUGGESTION_SOURCE, type Suggestion } from "./suggestion";

/** Transaction meta of the accepted suggestion, read by the capture layer. */
export const SUGGESTION_ACCEPT_META = "ductura:suggestion-accept";
export type AcceptMeta = { readonly suggestionId: string; readonly source: typeof SUGGESTION_SOURCE };

export type AcceptPlan = { from: number; to: number; insert: string };

/** The editor position range of the anchored text, or null when it is not found reliably. */
export function planAcceptance(doc: PmNode, suggestion: Pick<Suggestion, "anchor" | "replacement">): AcceptPlan | null {
  let plan: AcceptPlan | null = null;
  doc.descendants((node, pos) => {
    if (plan || !node.isTextblock) return !plan;
    if (node.attrs[NODE_ID_ATTRIBUTE] !== suggestion.anchor.nodeId) return false;
    // Text offsets are measured over text nodes only; an inline atom (citation, footnote) takes a
    // document position but no text, so each offset is mapped through the children, never added to pos + 1.
    const runs: { text: number; pos: number; length: number }[] = [];
    let text = "";
    node.forEach((child, offset) => {
      if (child.isText) { runs.push({ text: text.length, pos: pos + 1 + offset, length: child.nodeSize }); text += child.text; }
    });
    const found = resolveTextAnchor(suggestion.anchor, suggestion.anchor.nodeId, text);
    if (found.status !== "exact" && found.status !== "moved") return false;
    if (text.slice(found.start, found.end) !== suggestion.anchor.quote) return false;
    const first = runs.findLast((r) => r.text <= found.start);
    const last = runs.findLast((r) => r.text < found.end);
    if (!first || !last) return false;
    const from = first.pos + (found.start - first.text);
    const to = last.pos + (found.end - last.text);
    // A range that crosses a non-text node holds more than the quoted text: refuse it.
    if (to - from !== found.end - found.start) return false;
    plan = { from, to, insert: suggestion.replacement };
    return false;
  });
  return plan;
}

/** The transaction that applies the plan, carrying the source of the change. */
export function acceptanceTransaction(state: EditorState, plan: AcceptPlan, suggestionId: string): Transaction {
  const meta: AcceptMeta = { suggestionId, source: SUGGESTION_SOURCE };
  return state.tr.insertText(plan.insert, plan.from, plan.to).setMeta(SUGGESTION_ACCEPT_META, meta);
}
