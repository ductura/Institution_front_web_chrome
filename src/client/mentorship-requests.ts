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
 * Both routes are in the migration contract in the server's shape (LOK-WEB-5,
 * openapi v1): the list names the student by given and family name (or not at
 * all) and carries no title; the decision answer repeats the decision and, for
 * an approval, gives the new mentorship's id. The caller passes the transport
 * (`MentorshipCall`): the page gives the contract client, tests a fake.
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export type MentorshipCall = (
  id: "teacher.mentorship-requests.get" | "teacher.mentorship-request-decision.post",
  input: { readonly params: undefined; readonly query: undefined; readonly body?: DecisionInput },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type MentorshipRequest = {
  readonly requestId: string;
  /** "Given Family", or null when the server does not name the student. */
  readonly studentName: string | null;
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
  | { readonly kind: "greska"; readonly code: "invalid" }
  /** 408, 503, a broken connection, any other shape: the decision may be recorded. */
  | { readonly kind: "nepoznato" };

export const REASON_MAX = 600;

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const NAME = { type: "string", minLength: 1, maxLength: 255 } as const;
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const WORK_TYPES = ["bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"];
const DECISION = { anyOf: [{ const: "approve" }, { const: "decline" }] } as const;

// openapi v1: teacher.mentorship-requests.get and teacher.mentorship-request-decision.post.
const REQUESTS: Schema = closed({
  requests: {
    type: "array",
    items: closed({
      requestId: UUID,
      student: { anyOf: [{ type: "null" }, closed({ givenName: NAME, familyName: NAME })] },
      workType: { anyOf: WORK_TYPES.map((c) => ({ const: c })) },
      requestedAt: { type: "string", format: "date-time" },
    }),
  },
});
const DECIDED: Schema = { anyOf: [closed({ decision: { const: "approve" }, mentorshipId: UUID }), closed({ decision: { const: "decline" } })] };
type WireRequest = Omit<MentorshipRequest, "studentName"> & { student: { givenName: string; familyName: string } | null };
const REASON = { type: "string", minLength: 1, maxLength: REASON_MAX } as const;

/** teacher.mentorship-requests.get. */
export async function readMentorshipRequests(call: MentorshipCall): Promise<Read<{ kind: "ready"; requests: MentorshipRequest[] }>> {
  try {
    const result = await call("teacher.mentorship-requests.get", { params: undefined, query: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(REQUESTS, result.body)) return UNKNOWN;
    const wire = (result.body as { requests: WireRequest[] }).requests;
    if (new Set(wire.map((r) => r.requestId)).size !== wire.length) return UNKNOWN;
    const requests = wire.map(({ student, ...rest }): MentorshipRequest => ({
      ...rest, studentName: student === null ? null : `${student.givenName} ${student.familyName}`,
    }));
    return { kind: "ready", requests };
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

/** teacher.mentorship-request-decision.post. Never throws. */
export async function decideMentorshipRequest(call: MentorshipCall, input: DecisionInput): Promise<DecisionOutcome> {
  if (!decisionSendable(input)) return { kind: "greska", code: "invalid" };
  const body: DecisionInput = input.reason === undefined
    ? { requestId: input.requestId, decision: input.decision }
    : { requestId: input.requestId, decision: input.decision, reason: input.reason };
  try {
    const result = await call("teacher.mentorship-request-decision.post", { params: undefined, query: undefined, body });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(DECIDED, result.body)) return UNKNOWN;
      // The answer names no request; the same decision as the one sent is the success.
      const answer = result.body as { decision: Decision };
      return answer.decision === body.decision ? { kind: "odluceno", requestId: body.requestId, decision: answer.decision } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    // The server has no 404: another teacher's or an unknown request is a 409 like a decided one.
    if (result.status === 409) return { kind: "vec-odluceno" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
