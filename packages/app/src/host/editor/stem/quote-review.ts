// WEB-2134: the card "Navodi prema izvoru" of the review (stem.js `RP.PRE.qv`). The count is "Potvrđeno: N" when
// every quote with a source is confirmed and "N od M potvrđeno" otherwise; quotes with nothing to compare with
// are listed apart and never counted against the student.
import type { CanonicalDocumentV4 } from "../../../../../editor-core/src/document/document/index.ts";

import { checkQuote, findQuotes, type EvidenceBySource, type FoundQuote, type QuoteVerdict } from "./quote-check";
import { stemHr as m } from "./messages.hr";

export type ReviewedQuote = { readonly found: FoundQuote; readonly verdict: QuoteVerdict; readonly dismissed: boolean };

export type QuoteReview = {
  readonly quotes: readonly ReviewedQuote[];
  /** Quotes that could be compared (a verdict other than "none"). */
  readonly checked: number;
  readonly confirmed: number;
  /** Mismatches the student has not marked "U redu je ovako". */
  readonly open: readonly ReviewedQuote[];
  readonly summary: string;
};

/** The key a student's "U redu je ovako" is kept under: the block and the quote text. */
export const dismissKey = (f: FoundQuote): string => `${f.blockId}|${f.quote}`;

export function reviewQuotes(doc: CanonicalDocumentV4, evidence: EvidenceBySource, dismissed: ReadonlySet<string> = new Set()): QuoteReview {
  const quotes = findQuotes(doc).map((found) => ({ found, verdict: checkQuote(found, evidence[found.sourceId]), dismissed: dismissed.has(dismissKey(found)) }));
  const compared = quotes.filter((q) => q.verdict.kind !== "none");
  const confirmed = compared.filter((q) => q.verdict.kind === "ok").length;
  const open = compared.filter((q) => q.verdict.kind !== "ok" && !q.dismissed);
  const summary = quotes.length === 0 ? m.review.empty
    : compared.length === 0 ? m.review.unchecked
    : confirmed === compared.length ? m.review.allConfirmed(confirmed)
    : m.review.someConfirmed(confirmed, compared.length);
  return { quotes, checked: compared.length, confirmed, open, summary };
}
