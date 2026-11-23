// "Podudara se s odgovorom pomoćnika" (WEB-1230; P-1 rule 13; SRV-1230). Server operations:
//   work.assistant-match.get      { documentId }                    -> 200 { enabled, matches }
//   work.assistant-match.explain  { documentId, segmentId, text }   -> 200 the match with the explanation
// Neither is in the contract extract yet, so the names follow the `work.*` operations and the shape is the
// smallest the spec implies; both are listed as assumptions in the pull request. `enabled` mirrors the faculty
// flag `assistantMatchEnabled`: when it is false the server computes and stores nothing, and this client shows
// nothing. The answer is held to a closed schema: no claim of copying, no verdict, no score.
// PIL-P1-PODUDARANJE-KARTA moved this file here from teacher/origin-map unchanged: the notice is its only user.
// The real routes reach the notice through the adapter in src/client/assistant-match.ts (PIL-P1-PODUDARANJE-EDITOR),
// which answers in this shape; the map reads the same route through provenance/contract.ts.
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";

export type MatchCall = (
  id: "work.assistant-match.get" | "work.assistant-match.explain",
  input: { readonly params?: Readonly<Record<string, string>>; readonly query?: unknown; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** The rule: this many words in a row equal to an answer of the assistant (P-1 rule 13). */
export const MIN_MATCH_WORDS = 8;
export const MAX_EXPLANATION_LENGTH = 2000;

export type AssistantMatch = {
  readonly segmentId: string;
  /** The conversation attached to the declaration by the server, as transferred text (D-41). */
  readonly conversationId: string;
  readonly attachedAt: string;
  readonly words: number;
  readonly explanation?: { readonly text: string; readonly at: string };
};
export type MatchState = { readonly enabled: boolean; readonly matches: readonly AssistantMatch[] };

export type MatchRead =
  | { readonly kind: "ready"; readonly state: MatchState }
  | { readonly kind: "off" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type ExplainResult = { readonly kind: "saved"; readonly match: AssistantMatch } | { readonly kind: "signedOut" | "rejected" | "failed" };

const MATCH_SCHEMA: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["segmentId", "conversationId", "attachedAt", "words"],
  properties: {
    segmentId: { type: "string", minLength: 1 },
    conversationId: { type: "string", minLength: 1 },
    attachedAt: { type: "string", format: "date-time" },
    words: { type: "integer", minimum: MIN_MATCH_WORDS },
    explanation: {
      type: "object",
      additionalProperties: false,
      required: ["text", "at"],
      properties: { text: { type: "string", minLength: 1, maxLength: MAX_EXPLANATION_LENGTH }, at: { type: "string", format: "date-time" } },
    },
  },
};
const STATE_SCHEMA: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["enabled", "matches"],
  properties: { enabled: { type: "boolean" }, matches: { type: "array", items: MATCH_SCHEMA } },
};

const UNAVAILABLE = { kind: "unavailable" } as const;

/** Reads the matches of one work. The student and the teacher send the same request and get the same answer. */
export async function readAssistantMatch(call: MatchCall, documentId: string): Promise<MatchRead> {
  if (documentId.length === 0) return { kind: "notFound" };
  let result: Awaited<ReturnType<MatchCall>>;
  try {
    result = await call("work.assistant-match.get", { params: { documentId } });
  } catch {
    return UNAVAILABLE;
  }
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : result.status === 404 ? { kind: "notFound" } : UNAVAILABLE;
  if (result.status !== 200 || !matchesSchema(STATE_SCHEMA, result.body)) return UNAVAILABLE;
  const state = result.body as MatchState;
  // A switched-off flag with matches in the answer is a contract breach, not a display choice.
  if (!state.enabled) return state.matches.length === 0 ? { kind: "off" } : UNAVAILABLE;
  const ids = state.matches.map((m) => m.segmentId);
  return new Set(ids).size === ids.length ? { kind: "ready", state } : UNAVAILABLE;
}

/** The student's explanation of one match. Only the student of the work may send it; the server decides. */
export async function explainAssistantMatch(call: MatchCall, documentId: string, segmentId: string, text: string): Promise<ExplainResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EXPLANATION_LENGTH) return { kind: "rejected" };
  let result: Awaited<ReturnType<MatchCall>>;
  try {
    result = await call("work.assistant-match.explain", { params: { documentId, segmentId }, body: { text: trimmed } });
  } catch {
    return { kind: "failed" };
  }
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : result.status === 400 || result.status === 422 ? { kind: "rejected" } : { kind: "failed" };
  if (result.status !== 200 || !matchesSchema(MATCH_SCHEMA, result.body)) return { kind: "failed" };
  return { kind: "saved", match: result.body as AssistantMatch };
}
