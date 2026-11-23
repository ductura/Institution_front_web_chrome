// The pure part of the assistant match (PIL-P1-PODUDARANJE-KARTA; WEB-1230; P-1 rule 13). No verdict, no score:
// the share is the server's own percent and the rows follow the server's order.
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";

import { matchText as t } from "./match-messages.hr";
import { originText } from "./origin-messages.hr";

/** One finding as the contract names it: 8 or more words in a row equal to an answer of the assistant. */
export type MatchFinding = {
  readonly segmentRef: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly runWords: number;
  readonly recordedAt: string;
  readonly attachedAt: string;
};

export type MatchRead =
  | { readonly kind: "ready"; readonly percent: number; readonly findings: readonly MatchFinding[] }
  /** No finding and no share: the faculty flag is off, or nothing matches. The section does not exist. */
  | { readonly kind: "none" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

/** The read of both answers; the share of any other kind is not looked at. */
export function matchOf(findings: readonly MatchFinding[], parts: readonly { readonly kind: string; readonly percent: number }[]): MatchRead {
  const percent = parts.find((part) => part.kind === "assistant_match")?.percent ?? 0;
  return findings.length === 0 && percent === 0 ? { kind: "none" } : { kind: "ready", percent, findings };
}

/** „Podudara se s odgovorom pomoćnika · N %”, with „manje od 1 %” for a share that rounds to nothing. */
export function shareLabel(percent: number): string {
  const value = percent < 1 ? originText.lessThanOne : `${Math.round(percent)} %`;
  return `${originText.kindAssistantMatch} · ${value}`;
}

export type MatchRow = { readonly key: string; readonly words: string; readonly recorded: string; readonly attached: string };

/** One row per finding, in the server's order, never sorted or counted by size. The key carries the position: the
 * contract does not make a segment and a message unique together. */
export function matchRows(findings: readonly MatchFinding[]): readonly MatchRow[] {
  return findings.map((f, index) => ({
    key: `${index}:${f.segmentRef}:${f.messageId}`,
    words: t.words(f.runWords),
    recorded: formatDateTimeHr(f.recordedAt),
    attached: formatDateTimeHr(f.attachedAt),
  }));
}
