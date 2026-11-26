/**
 * Sitnice (WEB-1103, E§3.5 review2 and E§3.4 wizard): the small slips of
 * writing the Pregled card names as "Sitnica u pisanju", found here as exact
 * edits: double spaces, a space before punctuation, a missing space after a
 * comma, a colon or a semicolon, straight quotation marks and doubled
 * punctuation.
 *
 * - Each fix is a range of one text block and the text that replaces it.
 *   Nothing here sends or stores anything.
 * - Text the student pasted or imported is never touched (marks `paste` and
 *   `imported`): a fix that reaches into such text is skipped and counted.
 *   Quotations (`quote`), headings and inline atoms (citations, notes) are
 *   left alone as well.
 * - The edits go through the editor's own transactions. One fix is one
 *   transaction; all fixes together are one transaction with the same
 *   history and evidence handling as "replace all" (`FIND_REPLACE_META`,
 *   `closeHistory`), so one Ctrl+Z takes the whole batch back.
 */

import { closeHistory } from "@tiptap/pm/history";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { FIND_REPLACE_META } from "@/editor";

export const FIX_KINDS = ["spaces", "before", "after", "double", "quotes"] as const;
export type FixKind = (typeof FIX_KINDS)[number];

/** Most edits one batch makes; like "replace all", it keeps one evidence event well under the segment limit. */
export const MAX_BATCH_EDITS = 1_000;

export type FixEdit = { readonly from: number; readonly to: number; readonly replacement: string };

export type TextFix = {
  /** Stable for one document: kind, block position and offset in the block. */
  readonly id: string;
  readonly kind: FixKind;
  readonly blockId: string | null;
  /** One edit, or both marks of a pair of quotation marks: a fix is always applied whole. */
  readonly edits: readonly FixEdit[];
  /** The words around the slip, shortened, for the list. */
  readonly excerpt: string;
  /** "Prije i poslije": the words around the slip, with each edit apart (what goes and what comes). */
  readonly change: readonly ChangePart[];
};

/** A run of the text around a fix: unchanged, or one edit (removed text and its replacement, either may be empty). */
export type ChangePart =
  | { readonly kind: "same"; readonly text: string }
  | { readonly kind: "edit"; readonly removed: string; readonly added: string };

export type FixScan = {
  /** The document scanned; a fix applies only to this document. */
  readonly doc: PmNode;
  readonly fixes: readonly TextFix[];
  /** Slips left alone because they sit in pasted or imported text. */
  readonly skippedProvenance: number;
};

const LEAF = "￼";
const PROVENANCE = ["paste", "imported"] as const;
const FIXABLE_BLOCKS = new Set(["paragraph", "bulletItem"]);

type Piece = { readonly text: string; readonly provenance: boolean };

const PATTERNS: readonly { kind: FixKind; pattern: RegExp }[] = [
  { kind: "spaces", pattern: /(?<=\S)( {2,})(?=\S)/gu },
  { kind: "before", pattern: /( )(?=[,;:.!?](?!\.))/gu },
  { kind: "after", pattern: /(?<=[,;:])(?=\p{L})/gu },
  { kind: "double", pattern: /,,|;;|(?<!\.)\.\.(?!\.)|!!|\?\?/gu },
];

const shorten = (text: string, from: number, to: number) => {
  const flat = text.slice(Math.max(0, from - 15), to + 15).replaceAll(LEAF, "").replace(/\s+/g, " ").trim();
  return flat.length > 50 ? `${flat.slice(0, 49)}…` : flat;
};

/**
 * The words around a fix for "Prije i poslije", with block-local edits kept apart. Spaces stay as
 * they are (a double space is the slip itself); a run cut at a word gets "…".
 */
export function changeAround(text: string, edits: readonly FixEdit[]): ChangePart[] {
  const first = edits[0];
  const last = edits[edits.length - 1];
  if (!first || !last) return [];
  const lo = Math.max(0, first.from - 15);
  const hi = Math.min(text.length, last.to + 15);
  const same = (from: number, to: number) => text.slice(from, to).replaceAll(LEAF, "");
  const parts: ChangePart[] = [];
  const push = (part: ChangePart) => { if (part.kind === "edit" || part.text !== "") parts.push(part); };
  let at = lo;
  for (const edit of edits) {
    push({ kind: "same", text: same(at, edit.from) });
    push({ kind: "edit", removed: text.slice(edit.from, edit.to), added: edit.replacement });
    at = edit.to;
  }
  push({ kind: "same", text: same(at, hi) });
  const head = parts[0];
  if (lo > 0 && head?.kind === "same") parts[0] = { kind: "same", text: `…${head.text.trimStart()}` };
  const tail = parts[parts.length - 1];
  if (hi < text.length && tail?.kind === "same") parts[parts.length - 1] = { kind: "same", text: `${tail.text.trimEnd()}…` };
  return parts;
}

/** The text of a textblock with one stand-in per atom and a flag per character for pasted or imported runs. */
function flatten(block: PmNode): { text: string; flags: boolean[] } {
  let text = "";
  const flags: boolean[] = [];
  block.forEach((child) => {
    if (child.isText) {
      const flag = child.marks.some((mark) => (PROVENANCE as readonly string[]).includes(mark.type.name));
      text += child.text!;
      for (let i = 0; i < child.text!.length; i += 1) flags.push(flag);
    } else {
      text += LEAF.repeat(child.nodeSize);
      for (let i = 0; i < child.nodeSize; i += 1) flags.push(true);
    }
  });
  return { text, flags };
}

type Raw = { kind: FixKind; edits: FixEdit[] };

function rawFixes(text: string): Raw[] {
  const out: Raw[] = [];
  for (const { kind, pattern } of PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const from = m.index!;
      const to = from + m[0].length;
      const replacement = kind === "spaces" || kind === "after" ? " " : kind === "before" ? "" : m[0][0]!;
      out.push({ kind, edits: [{ from, to, replacement }] });
    }
  }
  // Straight quotes are paired in order inside the block; an odd number is ambiguous and left alone.
  const quotes = [...text.matchAll(/"/gu)].map((m) => m.index!);
  if (quotes.length > 0 && quotes.length % 2 === 0) {
    for (let i = 0; i < quotes.length; i += 2) {
      out.push({ kind: "quotes", edits: [
        { from: quotes[i]!, to: quotes[i]! + 1, replacement: "„" },
        { from: quotes[i + 1]!, to: quotes[i + 1]! + 1, replacement: "”" },
      ] });
    }
  }
  return out.sort((a, b) => a.edits[0]!.from - b.edits[0]!.from);
}

/** Every fix of the document, in document order. */
export function scanFixes(doc: PmNode): FixScan {
  const fixes: TextFix[] = [];
  let skippedProvenance = 0;
  doc.forEach((block, blockPos) => {
    if (!FIXABLE_BLOCKS.has(block.type.name) || !block.isTextblock) return;
    const { text, flags } = flatten(block);
    const nodeId = block.attrs["nodeId"];
    const blockId = typeof nodeId === "string" && nodeId !== "" ? nodeId : null;
    let lastTo = -1;
    for (const raw of rawFixes(text)) {
      // A fix reaching into pasted or imported text, or an atom, is not ours to make. An insertion looks at both neighbours.
      const spans = raw.edits.map((e) => (e.from === e.to ? [Math.max(0, e.from - 1), Math.min(flags.length, e.to + 1)] : [e.from, e.to]) as [number, number]);
      if (spans.some(([lo, hi]) => text.slice(lo, hi).includes(LEAF))) continue;
      if (spans.some(([lo, hi]) => flags.slice(lo, hi).some(Boolean))) { skippedProvenance += 1; continue; }
      const first = raw.edits[0]!;
      const last = raw.edits[raw.edits.length - 1]!;
      if (first.from < lastTo) continue; // overlapping slips: the next scan finds what is left
      lastTo = last.to;
      fixes.push({
        id: `${raw.kind}:${blockPos}:${first.from}`, kind: raw.kind, blockId,
        edits: raw.edits.map((e) => ({ from: blockPos + 1 + e.from, to: blockPos + 1 + e.to, replacement: e.replacement })),
        excerpt: shorten(text, first.from, last.to),
        change: changeAround(text, raw.edits),
      });
    }
  });
  return { doc, fixes, skippedProvenance };
}

export type ApplyRefusal = "stale" | "none";
export type ApplyOutcome =
  | { readonly ok: true; readonly tr: Transaction; readonly count: number }
  | { readonly ok: false; readonly reason: ApplyRefusal };

function build(state: EditorState, scan: FixScan, wanted: readonly TextFix[]): ApplyOutcome {
  if (state.doc !== scan.doc) return { ok: false, reason: "stale" };
  // Whole fixes only, and no more edits than one evidence event safely holds.
  const chosen: TextFix[] = [];
  let edits = 0;
  for (const fix of wanted) {
    if (edits + fix.edits.length > MAX_BATCH_EDITS) break;
    chosen.push(fix);
    edits += fix.edits.length;
  }
  if (chosen.length === 0) return { ok: false, reason: "none" };
  const { schema } = state;
  const tr = state.tr;
  for (const edit of chosen.flatMap((fix) => fix.edits).sort((a, b) => b.from - a.from)) {
    if (edit.replacement === "") tr.delete(edit.from, edit.to);
    else {
      const marks = (state.doc.nodeAt(edit.from) ?? state.doc.nodeAt(edit.from - 1))?.marks ?? [];
      if (edit.from === edit.to) tr.insert(edit.from, schema.text(edit.replacement, marks));
      else tr.replaceWith(edit.from, edit.to, schema.text(edit.replacement, marks));
    }
  }
  if (!tr.docChanged) return { ok: false, reason: "none" };
  closeHistory(tr);
  tr.setMeta(FIND_REPLACE_META, true);
  return { ok: true, tr, count: chosen.length };
}

/** One transaction for one fix of `scan`. */
export function applyFix(state: EditorState, scan: FixScan, id: string): ApplyOutcome {
  return build(state, scan, scan.fixes.filter((fix) => fix.id === id));
}

/** One transaction for the fixes of `scan` (or the ones `only` names), at most `MAX_BATCH_EDITS` edits: one undo step. A rescan offers the rest. */
export function applyAllFixes(state: EditorState, scan: FixScan, only?: (fix: TextFix) => boolean): ApplyOutcome {
  return build(state, scan, only ? scan.fixes.filter(only) : scan.fixes);
}

/** The fix after `afterId` in document order, wrapping to the first; null when there are none. */
export function nextFix(fixes: readonly TextFix[], afterId: string | null): TextFix | null {
  if (fixes.length === 0) return null;
  const at = afterId === null ? -1 : fixes.findIndex((fix) => fix.id === afterId);
  return fixes[(at + 1) % fixes.length] ?? null;
}
