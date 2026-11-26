// WEB-2134: finds the literal quotes of a work that are followed by a citation and compares each with the
// text of the page the student attached or with their own note on the source (stem.js `judge`, B-8).
// It runs on the device only; the text of a proof never leaves it. The comparison itself is
// `judgeQuote` of the proofs module, unchanged.
import type { CanonicalDocumentV4, InlineNodeV4, NodeId } from "../../../../../editor-core/src/document/document/index.ts";
import { judgeQuote, normalizeQuote } from "../../../../../../src/components/editor/sources/proofs/quote-match";

import { stemHr as m } from "./messages.hr";

/** A quote shorter than this is not judged (prototype: 15 characters). */
export const QUOTE_FIND_MIN = 15;
/** The citation must follow the closing mark within this many characters (prototype: 60). */
export const CITATION_REACH = 60;
/** A note of at most this many characters is too short to compare with (prototype: > 20). */
export const NOTE_MIN = 20;

export type FoundQuote = { readonly blockId: NodeId; readonly quote: string; readonly sourceId: string; readonly locator: string | null };

/** What the student attached to one source: pages of a proof (text layer) and notes. */
export type SourceEvidence = {
  readonly proofs: readonly { readonly page: string; readonly text: string }[];
  readonly notes: readonly { readonly text: string }[];
};
export type EvidenceBySource = Readonly<Record<string, SourceEvidence | undefined>>;

const QUOTE = /„([^„“”]+)[“”]/g;

/** Every literal quote („…”, at least 15 characters) followed within 60 characters by a citation. */
export function findQuotes(doc: CanonicalDocumentV4): FoundQuote[] {
  const found: FoundQuote[] = [];
  for (const node of doc.nodes) {
    if (node.type !== "paragraph" && node.type !== "bulletItem" && node.type !== "quote" && node.type !== "orderedItem") continue;
    scan(node.id, node.children, found);
  }
  return found;
}

function scan(blockId: NodeId, children: readonly InlineNodeV4[], out: FoundQuote[]): void {
  // One string for the block; a citation takes one private-use mark so offsets stay honest.
  const marker = "\uE000";
  const cites: { sourceId: string; locator: string | null }[] = [];
  let text = "";
  for (const child of children) {
    if (child.type === "text") text += child.text;
    else if (child.type === "citation") { text += marker; cites.push({ sourceId: child.sourceId, locator: child.locator ?? null }); }
    else if (child.type === "inlineFormula") text += " ";
    else text += " ";
  }
  const markAt: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] === marker) markAt.push(i);
  for (const match of text.matchAll(QUOTE)) {
    const quote = match[1]!.trim();
    if (quote.length < QUOTE_FIND_MIN) continue;
    const end = (match.index ?? 0) + match[0].length;
    const k = markAt.findIndex((at) => at >= end && at - end <= CITATION_REACH);
    if (k === -1) continue;
    const cite = cites[k]!;
    out.push({ blockId, quote, sourceId: cite.sourceId, locator: cite.locator });
  }
}

export type QuoteVerdict =
  /** The quote is in the proof or the note; `page` is where, when it is a proof. */
  | { readonly kind: "ok"; readonly message: string }
  | { readonly kind: "page"; readonly message: string }
  | { readonly kind: "differs"; readonly message: string; readonly near: string }
  | { readonly kind: "missing"; readonly message: string }
  /** Nothing attached to compare with, or a scan, or too little text: no verdict. */
  | { readonly kind: "none" };

/** The page number a locator names ("str. 12", "12", "12–13" → "12"), or null. */
export function locatorPage(locator: string | null): string | null {
  const hit = locator === null ? null : /\d+/.exec(locator);
  return hit === null ? null : hit[0];
}

/** One quote against what is attached to its source. Notes count only when longer than 20 characters. */
export function checkQuote(found: FoundQuote, evidence: SourceEvidence | undefined): QuoteVerdict {
  if (evidence === undefined || normalizeQuote(found.quote).length < 8) return { kind: "none" };
  const proofs = evidence.proofs.map((p) => ({ ...p, judged: judgeQuote(found.quote, p.text) })).filter((p) => p.judged.kind !== "scan" && p.judged.kind !== "short");
  const notes = evidence.notes.filter((n) => n.text.length > NOTE_MIN).map((n) => ({ ...n, judged: judgeQuote(found.quote, n.text) })).filter((n) => n.judged.kind !== "scan" && n.judged.kind !== "short");
  if (proofs.length === 0 && notes.length === 0) return { kind: "none" };
  const quoted = locatorPage(found.locator);
  const inProof = proofs.filter((p) => p.judged.kind === "found");
  if (inProof.length > 0) {
    const pages = inProof.map((p) => locatorPage(p.page));
    if (quoted === null || pages.includes(quoted) || pages.every((p) => p === null)) return { kind: "ok", message: m.quote.matchesProof(pages.find((p) => p !== null) ?? null) };
    return { kind: "page", message: m.quote.pageDiffers(pages.find((p) => p !== null) ?? "?", quoted) };
  }
  if (notes.some((n) => n.judged.kind === "found")) return { kind: "ok", message: m.quote.matchesNote };
  const near = [...proofs.map((p) => ({ p, where: m.quote.inProof })), ...notes.map((p) => ({ p, where: m.quote.inNote }))].find(({ p }) => p.judged.kind === "differs");
  if (near !== undefined && near.p.judged.kind === "differs") {
    return { kind: "differs", near: near.p.judged.near, message: m.quote.differs(near.where, near.p.judged.missing.join(", ")) };
  }
  const where = proofs.length > 0 && notes.length > 0 ? m.quote.inEither : proofs.length > 0 ? m.quote.inProof : m.quote.inNote;
  return { kind: "missing", message: m.quote.notFound(where) };
}
