/**
 * Mentorship requests for the teacher (WEB-30; N-16, B-6, P-6).
 *
 * teacher.mentorship-requests.get lists the open requests;
 * teacher.mentorship-request-decision.post approves or declines one. The
 * decision is `odluceno` only after the server's answer names the same
 * request and decision (B-6): no success before that. A reason goes only with
 * `decline`, at most 600 characters (proposal, as PD-4); a reason with
 * `approve`, a blank or a longer one is not sent. Until P-6 the reason is
 * kept by the server only and never shown to the student.
 *
 * TODO(ugovor): both routes come with @ductura/contracts 3.2.0 (SRV-27,
 * SRV-32). Until then the shapes are local, the caller passes the transport
 * (`MentorshipCall`) and only tests call them, with invented answers.
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export type MentorshipCall = (
  id: "teacher.mentorship-requests.get" | "teacher.mentorship-request-decision.post",
  input: { readonly body?: DecisionInput },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type MentorshipRequest = {
  readonly requestId: string;
  readonly studentName: string | null;
  readonly title: string;
  readonly workType: string;
  readonly requestedAt: string;
};

export type Decision = "approve" | "decline";
export type DecisionInput = { readonly requestId: string; readonly decision: Decision; readonly reason?: string };
export type DecisionOutcome =
  | { readonly kind: "odluceno"; readonly requestId: string; readonly decision: Decision }
  /** 409: already decided or withdrawn; the list is read again. */
  | { readonly kind: "vec-odluceno" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the decision may be recorded. */
  | { readonly kind: "nepoznato" };

export const REASON_MAX = 600;

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const TEXT = { type: "string", minLength: 1, maxLength: 256 } as const;
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const WORK_TYPES = ["seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"];
const DECISION = { anyOf: [{ const: "approve" }, { const: "decline" }] } as const;

// TODO(ugovor): local shapes until 3.2.0 (SRV-27).
const REQUESTS: Schema = closed({
  requests: {
    type: "array",
    items: closed({
      requestId: UUID,
      studentName: { anyOf: [{ type: "null" }, TEXT] },
      title: TEXT,
      workType: { anyOf: WORK_TYPES.map((c) => ({ const: c })) },
      requestedAt: { type: "string", format: "date-time" },
    }),
  },
});
const DECIDED: Schema = closed({ requestId: UUID, decision: DECISION });
const REASON = { type: "string", minLength: 1, maxLength: REASON_MAX } as const;

/** teacher.mentorship-requests.get (TODO(ugovor)). */
export async function readMentorshipRequests(call: MentorshipCall): Promise<Read<{ kind: "ready"; requests: MentorshipRequest[] }>> {
  try {
    const result = await call("teacher.mentorship-requests.get", {});
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(REQUESTS, result.body)) return UNKNOWN;
    const { requests } = result.body as { requests: MentorshipRequest[] };
    return new Set(requests.map((r) => r.requestId)).size === requests.length ? { kind: "ready", requests } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** False when the input must not be sent: a reason with approve, a blank or an over-long one, a malformed id. */
export function decisionSendable(input: DecisionInput): boolean {
  if (!matchesSchema(UUID, input.requestId) || !matchesSchema(DECISION, input.decision)) return false;
  if (input.reason === undefined) return true;
  return input.decision === "decline" && matchesSchema(REASON, input.reason) && input.reason.trim() !== "";
}

/** teacher.mentorship-request-decision.post (TODO(ugovor)). Never throws. */
export async function decideMentorshipRequest(call: MentorshipCall, input: DecisionInput): Promise<DecisionOutcome> {
  if (!decisionSendable(input)) return { kind: "greska", code: "invalid" };
  const body: DecisionInput = input.reason === undefined
    ? { requestId: input.requestId, decision: input.decision }
    : { requestId: input.requestId, decision: input.decision, reason: input.reason };
  try {
    const result = await call("teacher.mentorship-request-decision.post", { body });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(DECIDED, result.body)) return UNKNOWN;
      const answer = result.body as { requestId: string; decision: Decision };
      return answer.requestId === body.requestId && answer.decision === body.decision
        ? { kind: "odluceno", requestId: answer.requestId, decision: answer.decision }
        : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "vec-odluceno" };
    // Another teacher's, an unknown and a malformed id are the same 404.
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
