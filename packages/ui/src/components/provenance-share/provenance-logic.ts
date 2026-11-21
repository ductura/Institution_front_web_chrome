// Provisional shapes from the SRV-1220 contract provenance-share-v1 (status PRIJEDLOG, not approved):
// they change with the contract. No route here; the catalogue passes invented records.

/** The five categories, in the contract's fixed order (1.2). The view never reorders them by size. */
export const SHARE_CATEGORIES = ["written", "ai_transferred", "pasted", "imported", "unattributed"] as const;
export type ShareCategory = (typeof SHARE_CATEGORIES)[number];

export type ShareEntry = { readonly category: ShareCategory; readonly codePoints: number; readonly percent: number };

export type ShareRecord = {
  readonly unit: "code_point";
  readonly totalCodePoints: number;
  readonly categories: readonly ShareEntry[];
  readonly notice: "not_authorship_evidence";
};

/** `to` is exclusive; both count Unicode code points of the block's text. */
export type MatchSpan = { readonly blockId: string; readonly from: number; readonly to: number };

export type AiMatchRecord = {
  readonly normalization: string;
  readonly minMatchCodePoints: number;
  readonly spans: readonly MatchSpan[];
  readonly notice: "not_authorship_evidence";
};

/** A block of the submitted version, as the student and the teacher both read it. */
export type ProvenanceBlock = { readonly id: string; readonly text: string };

const isCount = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * Whether a record can be shown as it is: all five categories once, code points adding up to the
 * total, and percents adding up to exactly 100 (or all 0 when there is no text). Anything else is
 * not shown at all, so the view never prints numbers that contradict each other.
 */
export function shareIsConsistent(share: ShareRecord): boolean {
  if (share.unit !== "code_point" || share.notice !== "not_authorship_evidence" || !isCount(share.totalCodePoints)) return false;
  if (share.categories.length !== SHARE_CATEGORIES.length) return false;
  if (!SHARE_CATEGORIES.every((c) => share.categories.filter((e) => e.category === c).length === 1)) return false;
  if (!share.categories.every((e) => isCount(e.codePoints) && isCount(e.percent) && e.percent <= 100)) return false;
  const points = share.categories.reduce((sum, e) => sum + e.codePoints, 0);
  const percents = share.categories.reduce((sum, e) => sum + e.percent, 0);
  return points === share.totalCodePoints && percents === (share.totalCodePoints === 0 ? 0 : 100);
}

/** The categories in the fixed order, whatever order the record lists them in. */
export function orderedShare(share: ShareRecord): ShareEntry[] {
  return SHARE_CATEGORIES.map((c) => share.categories.find((e) => e.category === c)!);
}

export type BlockPiece = { readonly text: string; readonly matched: boolean };

/**
 * Splits a block's text at the spans, counting code points. Returns null when a span does not fit
 * the block or overlaps another, so a record that does not match the text marks nothing.
 */
export function splitBlock(block: ProvenanceBlock, spans: readonly MatchSpan[]): BlockPiece[] | null {
  const points = Array.from(block.text);
  const own = spans.filter((s) => s.blockId === block.id).toSorted((a, b) => a.from - b.from);
  const pieces: BlockPiece[] = [];
  let at = 0;
  for (const span of own) {
    if (!isCount(span.from) || !Number.isInteger(span.to) || span.from < at || span.to <= span.from || span.to > points.length) return null;
    if (span.from > at) pieces.push({ text: points.slice(at, span.from).join(""), matched: false });
    pieces.push({ text: points.slice(span.from, span.to).join(""), matched: true });
    at = span.to;
  }
  if (at < points.length) pieces.push({ text: points.slice(at).join(""), matched: false });
  return pieces;
}

/** Every span names a block of the submitted version and fits it. */
export function matchIsConsistent(match: AiMatchRecord, blocks: readonly ProvenanceBlock[]): boolean {
  if (match.notice !== "not_authorship_evidence") return false;
  if (!match.spans.every((s) => blocks.some((b) => b.id === s.blockId))) return false;
  return blocks.every((b) => splitBlock(b, match.spans) !== null);
}
