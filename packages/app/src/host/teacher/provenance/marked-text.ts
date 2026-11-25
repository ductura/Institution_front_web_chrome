// PG-2 "Tekst rada s oznakama podrijetla" (WEB-NF5-KARTA; NF-5; origin-segments-v1): the pure part. The ranges of
// work.origin-segments.get are laid over the text blocks of the same revision (work.version.get). A range says
// where the text came from, never who typed it; nothing here is summed, ranked or turned into a measure.
import { ORIGIN_KINDS, type OriginKind } from "./origin";

export type OriginRange = {
  readonly blockId: string;
  readonly start: number;
  readonly end: number;
  readonly kind: OriginKind;
  readonly segmentRef: string | null;
};

/** One text block of the revision, its text in code points as the ranges count them (contract: `textBlocksOf`). */
export type TextBlock = { readonly id: string; readonly heading: boolean; readonly text: string };

/** A piece of one block: plain text, or a marked range with its number among the marks of the work (from 1). */
export type Run =
  | { readonly kind: null; readonly text: string }
  | { readonly kind: OriginKind; readonly text: string; readonly mark: number | null };

export type MarkedBlock = { readonly id: string; readonly heading: boolean; readonly typed: boolean; readonly runs: readonly Run[] };
export type Mark = { readonly mark: number; readonly kind: OriginKind; readonly text: string; readonly block: number };

export type MarkedText = {
  readonly revision: number;
  readonly blocks: readonly MarkedBlock[];
  /** Every range that is not typed, in reading order; "Sljedeće lijepljenje ili prijenos" steps through them. */
  readonly marks: readonly Mark[];
  /** Ranges that do not fit the text (unknown block, past its end, overlapping): left out and counted, never guessed. */
  readonly skipped: number;
};

const isKind = (value: unknown): value is OriginKind => (ORIGIN_KINDS as readonly unknown[]).includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The text blocks of a canonical document in document order, as the server's `textBlocksOf` without a citation
 * rendering: the text children joined, every other inline node adds nothing. A node whose children are nodes with
 * children of their own (a box) is walked in place. Null when the document is not a canonical document at all.
 */
export function textBlocksOfDocument(document: unknown): readonly TextBlock[] | null {
  if (!isRecord(document) || !Array.isArray(document.nodes)) return null;
  const out: TextBlock[] = [];
  const walk = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      if (!isRecord(node) || !Array.isArray(node.children)) continue;
      const children = node.children as readonly unknown[];
      if (children.some((child) => isRecord(child) && Array.isArray(child.children))) { walk(children); continue; }
      if (typeof node.id !== "string") continue;
      const text = children.map((child) => (isRecord(child) && child.type === "text" && typeof child.text === "string" ? child.text : "")).join("");
      out.push({ id: node.id, heading: node.type === "heading", text });
    }
  };
  walk(document.nodes as readonly unknown[]);
  return out;
}

/** Lays the ranges over the blocks. A block of one typed range keeps its text whole; marks are numbered in reading order. */
export function placeRanges(revision: number, blocks: readonly TextBlock[], ranges: readonly OriginRange[]): MarkedText {
  const byBlock = new Map<string, OriginRange[]>();
  const known = new Set(blocks.map((block) => block.id));
  let skipped = 0;
  for (const range of ranges) {
    if (!known.has(range.blockId) || !isKind(range.kind)) { skipped += 1; continue; }
    byBlock.set(range.blockId, [...(byBlock.get(range.blockId) ?? []), range]);
  }
  const marks: Mark[] = [];
  const out = blocks.map((block, index): MarkedBlock => {
    const points = Array.from(block.text);
    const runs: Run[] = [];
    let at = 0;
    let typed = false;
    const sorted = [...(byBlock.get(block.id) ?? [])].sort((a, b) => a.start - b.start || a.end - b.end);
    for (const range of sorted) {
      if (range.start < at || range.end > points.length || range.end <= range.start) { skipped += 1; continue; }
      if (range.start > at) runs.push({ kind: null, text: points.slice(at, range.start).join("") });
      const text = points.slice(range.start, range.end).join("");
      if (range.kind === "typed") {
        typed = true;
        runs.push({ kind: "typed", text, mark: null });
      } else {
        marks.push({ mark: marks.length + 1, kind: range.kind, text, block: index + 1 });
        runs.push({ kind: range.kind, text, mark: marks.length });
      }
      at = range.end;
    }
    if (at < points.length || runs.length === 0) runs.push({ kind: null, text: points.slice(at).join("") });
    return { id: block.id, heading: block.heading, typed, runs };
  });
  return { revision, blocks: out, marks, skipped };
}

/** The mark after `current` (0 = none yet); after the last it starts again at the first; 0 when there is no mark. */
export const nextMark = (current: number, count: number): number => (count === 0 ? 0 : (current % count) + 1);

/** A short excerpt for the list of segments: whole words up to `max` code points, then "…". */
export function excerpt(text: string, max = 80): string {
  const points = Array.from(text.trim());
  if (points.length <= max) return points.join("");
  const cut = points.slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
