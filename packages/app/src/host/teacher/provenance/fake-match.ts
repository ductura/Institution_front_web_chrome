// Invented answers of work.assistant-match.get and work.origin-composition.get for the assistant match section
// (PIL-P1-PODUDARANJE-KARTA). Tests only; no real person, conversation or text.
import type { MatchCall } from "./contract";
import type { MatchFinding, MatchRead } from "./match-model";

export const DOCUMENT = "izmisljeni-rad-1";

export const FAKE_FINDING: MatchFinding = {
  segmentRef: "odsjecak-3",
  conversationId: "00000000-0000-4000-8000-00000000c001",
  messageId: "00000000-0000-4000-8000-00000000a001",
  runWords: 11,
  recordedAt: "2026-11-18T09:40:00.000Z",
  attachedAt: "2026-11-18T09:40:00.000Z",
};

/** The six parts of the composition, with the given share of `assistant_match` and the rest typed. */
export const fakeParts = (matchPercent: number) => [
  { kind: "typed", percent: 100 - matchPercent }, { kind: "assistant_inserted", percent: 0 },
  { kind: "assistant_match", percent: matchPercent }, { kind: "imported_file", percent: 0 },
  { kind: "pasted_known", percent: 0 }, { kind: "pasted_unknown", percent: 0 },
];

/** A port that answers with the given read and counts the calls. */
export function fakeMatchCall(read: MatchRead) {
  const calls: string[] = [];
  const call: MatchCall = async (documentId) => { calls.push(documentId); return read; };
  return { call, calls };
}
