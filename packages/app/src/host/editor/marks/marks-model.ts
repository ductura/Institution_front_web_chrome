// WEB-2129: pure model of the in-text marks (INVENTAR-editor §2.6 text2). A mark
// is a place in the text with a level 0..4; nothing here touches the document.
import type { Node as PmNode } from "@tiptap/pm/model";

import { reviewPlaces } from "../../../../../../src/components/editor/citations/review-places.ts";
import { marksHr as t } from "./messages.hr";

export type MarkKind = "hole" | "plain" | "cmt" | "need" | "cite";
export type Level = 0 | 1 | 2 | 3 | 4;

export type Place = { readonly kind: MarkKind; readonly level: Level; readonly name: string; readonly from: number; readonly to: number };

/** Level per kind (prototype KINDS): 1 obvezno, 2 od mentora, 0 navod. */
export const LEVEL: Record<MarkKind, Level> = { hole: 1, plain: 1, cmt: 2, need: 2, cite: 0 };

/** A citation typed as text: "(Autor, 2020)", "(Izmišljeni i Drugi, 2019a)". */
const PLAIN_CITE = /\(\p{Lu}[^()\d￼]{1,40},\s*\d{4}[a-z]?\)/gu;

const place = (kind: MarkKind, from: number, to: number, name: string = t.kinds[kind]): Place =>
  ({ kind, level: LEVEL[kind], name, from, to });

export function holePlaces(doc: PmNode): Place[] {
  return reviewPlaces(doc).map((p) => place("hole", p.from, p.to));
}

export function plainCitePlaces(doc: PmNode): Place[] {
  const out: Place[] = [];
  doc.forEach((block, offset) => {
    if (!block.isTextblock) return;
    const text = block.textBetween(0, block.content.size, "", "￼");
    for (const m of text.matchAll(PLAIN_CITE)) out.push(place("plain", offset + 1 + m.index, offset + 1 + m.index + m[0].length));
  });
  return out;
}

/** Citations with a confirmation the mentor asked for (`rq`), from the v3 atom. */
export function needProofPlaces(doc: PmNode): Place[] {
  const out: Place[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "citation" && node.attrs.rq) out.push(place("need", pos, pos + node.nodeSize));
  });
  return out;
}

export function commentPlaces(ranges: readonly { from: number; to: number }[], doc: PmNode): Place[] {
  return ranges.map((r) => {
    const quote = doc.textBetween(r.from, Math.min(r.to, r.from + 34), " ", " ").trim();
    return place("cmt", r.from, r.to, quote ? `${t.kinds.cmt}: ${quote}` : t.kinds.cmt);
  });
}

export function allPlaces(doc: PmNode, comments: readonly { from: number; to: number }[]): Place[] {
  return [...holePlaces(doc), ...plainCitePlaces(doc), ...needProofPlaces(doc), ...commentPlaces(comments, doc)]
    .sort((a, b) => a.from - b.from || a.level - b.level);
}

const rank = (p: Place): number => (p.level === 0 ? 9 : p.level);

/** "Na ovom mjestu": every mark whose range holds `pos`, level 1 (obvezno) first, plain citations last. */
export function placesAt(places: readonly Place[], pos: number): Place[] {
  return places.filter((p) => pos >= p.from && pos <= p.to).sort((a, b) => rank(a) - rank(b) || a.from - b.from);
}

export function counts(places: readonly Place[]): Record<"hole" | "cmt" | "plain", number> {
  const n = { hole: 0, cmt: 0, plain: 0 };
  for (const p of places) if (p.kind === "hole" || p.kind === "cmt" || p.kind === "plain") n[p.kind] += 1;
  return n;
}

/** The mark after `from` of one kind, wrapping to the first; null when there is none. */
export function nextPlace(places: readonly Place[], kind: MarkKind, from: number): Place | null {
  const same = places.filter((p) => p.kind === kind);
  return same.find((p) => p.from > from) ?? same[0] ?? null;
}

/** ED-45 (P2-17): what "Provjereno, ukloni" takes out: the mark and one space after it, so no double space is left. */
export function holeRemoval(doc: PmNode, hole: Place): { from: number; to: number } {
  const after = hole.to < doc.content.size ? doc.textBetween(hole.to, hole.to + 1, "", "") : "";
  const before = hole.from > 0 ? doc.textBetween(hole.from - 1, hole.from, "", "") : "";
  return { from: hole.from, to: hole.to + (after === " " && (before === "" || before === " ") ? 1 : 0) };
}

export type Dot ={ readonly kind: "cmt" | "hole"; readonly y: number; readonly offset: number; readonly place: Place };

/** Gutter dots (comment, hole) at the height of the mark; dots at one height stack leftwards by 11 px. */
export function gutterDots(places: readonly Place[], topOf: (pos: number) => number | null): Dot[] {
  const used = new Map<number, number>();
  const dots: Dot[] = [];
  for (const p of places) {
    if (p.kind !== "cmt" && p.kind !== "hole") continue;
    const y = topOf(p.from);
    if (y === null) continue;
    const row = Math.round(y);
    const index = used.get(row) ?? 0;
    used.set(row, index + 1);
    dots.push({ kind: p.kind, y, offset: index * 11, place: p });
  }
  return dots;
}

/** The gutter is drawn only wider than 1050 px, as in the prototype. */
export const GUTTER_MIN_WIDTH = 1050;
export const showGutter = (innerWidth: number): boolean => innerWidth > GUTTER_MIN_WIDTH;
