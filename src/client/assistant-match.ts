// PIL-P1-PODUDARANJE-EDITOR (P-1 rule 13; SRV-1230 as merged): the student's read of the
// assistant matches of a work, over work.assistant-match.get. The server answers `findings`, one
// per answer of the assistant that a segment matches; the notice shows one item per segment. No
// finding is stored while the faculty switch (assistantMatchEnabled) is off, so an empty answer
// is how the switch reads here: nothing to show.
// ED-13 (NF2-P13): the student's explanation of a match goes to work.assistant-match-explanation.post,
// one per answer of the assistant (segmentRef + messageId); the read returns it on that finding.
import { createApi } from "./api";

export type MatchFinding = {
  readonly segmentRef: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly runWords: number;
  readonly recordedAt: string;
  readonly attachedAt: string;
  readonly explanation?: { readonly text: string; readonly writtenAt: string } | null;
};

/** One segment of the notice: its longest run, the conversation of that run, the latest attachment. */
export type SegmentMatch = {
  readonly segmentId: string;
  readonly conversationId: string;
  /** The answer of the assistant of the longest run: an explanation is sent for this one. */
  readonly messageId: string;
  readonly attachedAt: string;
  readonly words: number;
  /** The latest explanation the student wrote for any answer this segment matches. */
  readonly explanation?: { readonly text: string; readonly at: string };
};

/** The findings of each segment folded into one item, in the order the segments first appear. */
export function segmentsOf(findings: readonly MatchFinding[]): readonly SegmentMatch[] {
  const bySegment = new Map<string, SegmentMatch>();
  for (const f of findings) {
    const seen = bySegment.get(f.segmentRef);
    const longer = seen === undefined || f.runWords > seen.words;
    const written = f.explanation ?? undefined;
    const explanation = written !== undefined && (seen?.explanation === undefined || written.writtenAt > seen.explanation.at)
      ? { text: written.text, at: written.writtenAt }
      : seen?.explanation;
    bySegment.set(f.segmentRef, {
      segmentId: f.segmentRef,
      conversationId: longer ? f.conversationId : seen.conversationId,
      messageId: longer ? f.messageId : seen.messageId,
      words: longer ? f.runWords : seen.words,
      attachedAt: seen === undefined || f.attachedAt > seen.attachedAt ? f.attachedAt : seen.attachedAt,
      ...(explanation === undefined ? {} : { explanation }),
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
 * server stores none, so the notice shows nothing. An explanation goes to its own route with the
 * answer it explains and comes back as `{ text, at }`.
 */
export function createAssistantMatchCall(call: Call = createApi()): MatchCall {
  return async (id, input) => {
    const documentId = input.params?.documentId ?? "";
    if (id === "work.assistant-match.explain") {
      const body = (input.body ?? {}) as { text?: unknown; messageId?: unknown };
      const result = await call("work.assistant-match-explanation.post", {
        params: { documentId },
        query: undefined,
        body: { segmentRef: input.params?.segmentId ?? "", messageId: String(body.messageId ?? ""), text: String(body.text ?? "") },
      });
      if (!result.ok) return { ok: false, status: result.status, code: result.code };
      return { ok: true, status: result.status, body: { text: result.body.text, at: result.body.writtenAt } };
    }
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
