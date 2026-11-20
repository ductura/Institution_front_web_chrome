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

export type TextFix = {
  /** Stable for one document: kind, block position and offset in the block. */
  readonly id: string;
  readonly kind: FixKind;
  readonly blockId: string | null;
  readonly from: number;
  readonly to: number;
  readonly replacement: string;
  /** The words around the slip, shortened, for the list. */
  readonly excerpt: string;
};

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

type Raw = { kind: FixKind; from: number; to: number; replacement: string };

function rawFixes(text: string): Raw[] {
  const out: Raw[] = [];
  for (const { kind, pattern } of PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const from = m.index!;
      const to = from + m[0].length;
      if (kind === "spaces") out.push({ kind, from, to, replacement: " " });
      else if (kind === "before") out.push({ kind, from, to, replacement: "" });
      else if (kind === "after") out.push({ kind, from, to, replacement: " " });
      else out.push({ kind, from, to, replacement: m[0][0]! });
    }
  }
  // Straight quotes are paired in order inside the block; an odd number is ambiguous and left alone.
  const quotes = [...text.matchAll(/"/gu)].map((m) => m.index!);
  if (quotes.length > 0 && quotes.length % 2 === 0) {
    quotes.forEach((at, i) => out.push({ kind: "quotes", from: at, to: at + 1, replacement: i % 2 === 0 ? "„" : "”" }));
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
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
      const lo = raw.from === raw.to ? Math.max(0, raw.from - 1) : raw.from;
      const hi = raw.from === raw.to ? Math.min(flags.length, raw.to + 1) : raw.to;
      const touched = flags.slice(lo, hi);
      if (touched.some(Boolean)) {
        if (text.slice(lo, hi).includes(LEAF)) continue;
        skippedProvenance += 1;
        continue;
      }
      if (raw.from < lastTo) continue; // overlapping slips: the next scan finds what is left
      lastTo = raw.to;
      fixes.push({
        id: `${raw.kind}:${blockPos}:${raw.from}`, kind: raw.kind, blockId,
        from: blockPos + 1 + raw.from, to: blockPos + 1 + raw.to, replacement: raw.replacement,
        excerpt: shorten(text, raw.from, raw.to),
      });
    }
  });
  return { doc, fixes, skippedProvenance };
}

export type ApplyRefusal = "stale" | "none";
export type ApplyOutcome =
  | { readonly ok: true; readonly tr: Transaction; readonly count: number }
  | { readonly ok: false; readonly reason: ApplyRefusal };

function build(state: EditorState, scan: FixScan, chosen: readonly TextFix[]): ApplyOutcome {
  if (state.doc !== scan.doc) return { ok: false, reason: "stale" };
  if (chosen.length === 0) return { ok: false, reason: "none" };
  const { schema } = state;
  const tr = state.tr;
  for (const fix of [...chosen].reverse()) {
    if (fix.replacement === "") tr.delete(fix.from, fix.to);
    else {
      const marks = (state.doc.nodeAt(fix.from) ?? state.doc.nodeAt(fix.from - 1))?.marks ?? [];
      if (fix.from === fix.to) tr.insert(fix.from, schema.text(fix.replacement, marks));
      else tr.replaceWith(fix.from, fix.to, schema.text(fix.replacement, marks));
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

/** One transaction for every fix of `scan` (or of the ones `only` names): one undo step. */
export function applyAllFixes(state: EditorState, scan: FixScan, only?: (fix: TextFix) => boolean): ApplyOutcome {
  return build(state, scan, only ? scan.fixes.filter(only) : scan.fixes);
}

/** The fix after `afterId` in document order, wrapping to the first; null when there are none. */
export function nextFix(fixes: readonly TextFix[], afterId: string | null): TextFix | null {
  if (fixes.length === 0) return null;
  const at = afterId === null ? -1 : fixes.findIndex((fix) => fix.id === afterId);
  return fixes[(at + 1) % fixes.length] ?? null;
}
