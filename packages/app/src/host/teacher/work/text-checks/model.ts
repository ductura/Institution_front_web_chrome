// ED-130 (prototype review2.js `r2Cm`): the text checks in the teacher's view of a work, each with
// "U komentar". The checks are the editor's own (`runChecks`), run on the text the teacher sees; a
// finding becomes a new comment on its words, with a first line the teacher can change before
// publishing. Nothing is sent from here: the comment goes out only from Komentari.
import { CITATION_MARK, reviewDocOf, type BlockInput, type ReviewDoc } from "@/components/editor/review/model";
import { runChecks, type CheckId, type Finding } from "@/components/editor/review/checks";
import { anchorForSelection, blockText, type LiveBlock, type LiveTextDocument } from "@/components/teacher/comment-place";
import type { TextAnchor } from "@/domain/collaboration";

import { textChecksHr as t } from "./messages.hr";

/** How many characters a comment takes from the start of a finding when its words cannot be found again. */
export const FALLBACK_CHARS = 80;

const KIND_OF: Readonly<Record<string, BlockInput["kind"]>> = {
  heading: "heading", paragraph: "paragraph", quote: "quote", bulletItem: "list",
};

/** The block as the checks read it: a citation stands as one mark, as in the editor (`readReviewDoc`). */
function inputOf(node: LiveBlock): BlockInput {
  const kind = KIND_OF[node.type] ?? "other";
  if (kind === "other") return { id: node.id, kind, text: "" };
  let text = "";
  let citations = 0;
  for (const child of node.children) {
    if (child.type === "text") text += child.text;
    else if (child.type === "citation") { text += CITATION_MARK; citations += 1; }
  }
  const level = node.type === "heading" && "level" in node ? node.level : 0;
  return { id: node.id, kind, text, citations, level };
}

/** The model of the text on the teacher's screen. */
export function reviewDocOfLive(doc: LiveTextDocument): ReviewDoc {
  return reviewDocOf(doc.nodes.map(inputOf));
}

/** The first line of the comment a finding becomes; only the kinds the prototype turns into a comment. */
export function commentTextOf(kind: CheckId): string | null {
  return t.comment[kind as keyof typeof t.comment] ?? null;
}

/** The findings the teacher can turn into a comment. */
export function commentableFindings(doc: LiveTextDocument, enabled: readonly string[] | null): Finding[] {
  return runChecks(reviewDocOfLive(doc), enabled).filter((finding) => finding.blockId !== null && commentTextOf(finding.kind) !== null);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where the words of a finding stand in its block now. The excerpt is the block's words with white space
 * made single and maybe cut with "…"; it is found again with any white space between the words. When it
 * is not found (the text changed) the comment takes the start of the block.
 */
export function findingRange(doc: LiveTextDocument, finding: Finding): { nodeId: string; start: number; end: number } | null {
  const node = doc.nodes.find((n) => n.id === finding.blockId);
  if (!node) return null;
  const text = blockText(node);
  const words = finding.excerpt.replace(/…$/u, "").trim().split(/\s+/u).filter((w) => w !== "");
  if (words.length > 0) {
    const found = new RegExp(words.map(escape).join("\\s+"), "u").exec(text);
    if (found) return { nodeId: node.id, start: found.index, end: found.index + found[0].length };
  }
  return text.trim() === "" ? null : { nodeId: node.id, start: 0, end: Math.min(text.length, FALLBACK_CHARS) };
}

/** The anchor of the new comment for a finding, or null when its block has no words to anchor to. */
export function findingAnchor(doc: LiveTextDocument, finding: Finding): TextAnchor | null {
  const range = findingRange(doc, finding);
  if (!range) return null;
  return anchorForSelection(doc, range.nodeId, range.start, range.end)
    ?? anchorForSelection(doc, range.nodeId, range.start, Math.min(range.end, range.start + FALLBACK_CHARS));
}
