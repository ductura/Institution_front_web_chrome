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

// PIL-P1-PODUDARANJE-PROVJERA-WEB: what the student's editor sends, over work.assistant-match.post
// ({ segmentRef, text }). A finding exists only for a paragraph the server has seen, so the editor
// sends each paragraph the student changed once the change is saved on the server, with the block's
// own id as `segmentRef`. Nothing else leaves: no key, no timing, no other paragraph.

/** The rule counts this many words in a row (P-1 rule 13); a shorter paragraph can never match. */
export const MIN_SEGMENT_WORDS = 8;
/** The route's limits: `text` up to 40 000 characters, `segmentRef` up to 128 without control characters. */
export const MAX_SEGMENT_TEXT = 40_000;
const SEGMENT_REF = /^[^\u0000-\u001f\u007f-\u009f]{1,128}$/u;

/** One paragraph of the work: the id of its block and its text. */
export type Segment = { readonly ref: string; readonly text: string };

function wordsIn(text: string): number {
  return text.split(/\s+/u).filter((w) => w.length > 0).length;
}

/** The paragraph as it may be sent, or null when it cannot match or the route would refuse it. */
export function sendable(segment: Segment): Segment | null {
  if (!SEGMENT_REF.test(segment.ref)) return null;
  if (wordsIn(segment.text) < MIN_SEGMENT_WORDS) return null;
  const chars = Array.from(segment.text);
  return chars.length <= MAX_SEGMENT_TEXT ? segment : { ref: segment.ref, text: chars.slice(0, MAX_SEGMENT_TEXT).join("") };
}

/**
 * The paragraphs to send: those whose text differs from what was last sent (or, for a paragraph not
 * sent yet, from the text the work opened with), that could match and that the route accepts.
 */
export function changedSegments(current: readonly Segment[], known: ReadonlyMap<string, string>): readonly Segment[] {
  const out: Segment[] = [];
  for (const segment of current) {
    if (known.get(segment.ref) === segment.text) continue;
    const ready = sendable(segment);
    if (ready !== null) out.push(ready);
  }
  return out;
}

/** The server's answer to one paragraph, as the editor needs it. */
export type SegmentCheck =
  | { readonly kind: "checked"; readonly matches: number }
  | { readonly kind: "signedOut" }
  /** No such work for this person, or the route is absent: stop sending for this work. */
  | { readonly kind: "off" }
  /** Unreached, refused or unavailable: send again after the next save. */
  | { readonly kind: "failed" };

export type SegmentPort = (documentId: string, segment: Segment) => Promise<SegmentCheck>;

/**
 * The real port over work.assistant-match.post. A paragraph that cannot match is answered here,
 * without a request; a longer one is cut to the route's limit. It never throws into writing or saving.
 */
export function createSegmentPort(call: Call = createApi()): SegmentPort {
  return async (documentId, segment) => {
    const body = sendable(segment);
    if (body === null) return { kind: "checked", matches: 0 };
    try {
      const result = await call("work.assistant-match.post", {
        params: { documentId },
        query: undefined,
        body: { segmentRef: body.ref, text: body.text },
      });
      if (result.ok) return { kind: "checked", matches: result.body.matches.length };
      if (result.status === 401) return { kind: "signedOut" };
      if (result.status === 404) return { kind: "off" };
      return { kind: "failed" };
    } catch {
      return { kind: "failed" };
    }
  };
}
