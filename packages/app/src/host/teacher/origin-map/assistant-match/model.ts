import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import type { ProvenanceRead } from "../../../../../../../src/client/provenance";
import type { OriginComposition } from "../contract";
import type { AssistantMatch, MatchRead } from "./contract";
import { matchText as t } from "./messages.hr";

/** True only while the faculty flag is on and the server confirmed it; anything else shows nothing. */
export const matchShown = (read: MatchRead | null): read is Extract<MatchRead, { kind: "ready" }> => read !== null && read.kind === "ready";

/**
 * The composition without the assistant match when the flag is off: the share and the segments of that kind
 * disappear, and the percentages of the rest stay the server's own (nothing is recomputed on the client).
 */
export function withoutAssistantMatch(c: OriginComposition): OriginComposition {
  return {
    ...c,
    shares: c.shares.filter((s) => s.kind !== "assistant_match"),
    segments: c.segments.filter((s) => s.kind !== "assistant_match"),
  };
}

/** The provenance read of the declaration (variant U) without the match marker when the flag is off. */
export function gateProvenance(read: ProvenanceRead, enabled: boolean): ProvenanceRead {
  if (enabled || read.kind !== "ready" || read.aiMatch === undefined) return read;
  const { aiMatch: _aiMatch, ...rest } = read;
  return rest;
}

export type MatchRow = {
  readonly segmentId: string;
  readonly text: string;
  readonly words: string;
  readonly attached: string;
  readonly explanation: string | null;
};

/** One row per match, in the server's order, never sorted or counted by size. */
export function matchRows(matches: readonly AssistantMatch[], segmentText: (id: string) => string | undefined): readonly MatchRow[] {
  return matches.map((m) => ({
    segmentId: m.segmentId,
    text: segmentText(m.segmentId) ?? "",
    words: t.words(m.words),
    attached: formatDateTimeHr(m.attachedAt),
    explanation: m.explanation === undefined ? null : m.explanation.text,
  }));
}
