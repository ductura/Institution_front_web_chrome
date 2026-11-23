// PIL-P1-PODUDARANJE-EDITOR (P-1 rule 13; SRV-1230 as merged): the student's read of the
// assistant matches of a work, over work.assistant-match.get. The server answers `findings`, one
// per answer of the assistant that a segment matches; the notice shows one item per segment. No
// finding is stored while the faculty switch (assistantMatchEnabled) is off, so an empty answer
// is how the switch reads here: nothing to show. The server has no route that stores the
// student's explanation, so this port does not send one (the notice is mounted with `explainable={false}`).
import { createApi } from "./api";

export type MatchFinding = {
  readonly segmentRef: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly runWords: number;
  readonly recordedAt: string;
  readonly attachedAt: string;
};

/** One segment of the notice: its longest run, the conversation of that run, the latest attachment. */
export type SegmentMatch = { readonly segmentId: string; readonly conversationId: string; readonly attachedAt: string; readonly words: number };

/** The findings of each segment folded into one item, in the order the segments first appear. */
export function segmentsOf(findings: readonly MatchFinding[]): readonly SegmentMatch[] {
  const bySegment = new Map<string, SegmentMatch>();
  for (const f of findings) {
    const seen = bySegment.get(f.segmentRef);
    const longer = seen === undefined || f.runWords > seen.words;
    bySegment.set(f.segmentRef, {
      segmentId: f.segmentRef,
      conversationId: longer ? f.conversationId : seen.conversationId,
      words: longer ? f.runWords : seen.words,
      attachedAt: seen === undefined || f.attachedAt > seen.attachedAt ? f.attachedAt : seen.attachedAt,
    });
  }
  return [...bySegment.values()];
}

/** The answer the notice reads: the same shape for the student as for the teacher's map. */
export type MatchAnswer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
export type MatchCall = (
  id: "work.assistant-match.get" | "work.assistant-match.explain",
  input: { readonly params?: Readonly<Record<string, string>>; readonly query?: unknown; readonly body?: unknown },
) => Promise<MatchAnswer>;

type Call = ReturnType<typeof createApi>;

/**
 * The real port. A read answers `{ enabled, matches }` from the findings; with the switch off the
 * server stores none, so the notice shows nothing. A request for an explanation never leaves the
 * browser: it answers 404 as an absent route would.
 */
export function createAssistantMatchCall(call: Call = createApi()): MatchCall {
  return async (id, input) => {
    if (id !== "work.assistant-match.get") return { ok: false, status: 404, code: "not_found" };
    const documentId = input.params?.documentId ?? "";
    const result = await call("work.assistant-match.get", { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) return { ok: false, status: result.status, code: result.code };
    return { ok: true, status: result.status, body: { enabled: true, matches: segmentsOf(result.body.findings) } };
  };
}

// PIL-P1-PODUDARANJE-PROVJERA-WEB: a finding exists only once the student's editor sends a segment
// to work.assistant-match.post ({segmentRef, text}); the server compares it with the answers of the
// assistant in the student's own conversations, records each match once and attaches the
// conversation. With the faculty switch off it answers no match and stores nothing.
export type SegmentToCheck = { readonly segmentRef: string; readonly text: string };
export type SegmentCheckAnswer = { ok: true; matched: number } | { ok: false; status: number; code: string };
export type SegmentCheck = (documentId: string, segment: SegmentToCheck) => Promise<SegmentCheckAnswer>;

/** The real check: one segment per call, the answer reduced to how many answers it matched. */
export function createSegmentCheck(call: Call = createApi()): SegmentCheck {
  return async (documentId, segment) => {
    const result = await call("work.assistant-match.post", {
      params: { documentId },
      query: undefined,
      body: { segmentRef: segment.segmentRef, text: segment.text },
    });
    if (!result.ok) return { ok: false, status: result.status, code: result.code };
    return { ok: true, matched: result.body.matches.length };
  };
}
