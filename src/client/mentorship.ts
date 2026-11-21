/**
 * Mentorship from the student's side (WEB-1404; plan M2, D-204): the student
 * asks a teacher to mentor a work, sees the request as pending, approved or
 * declined, and may withdraw it until it is decided. The teacher's side
 * (list and decision) is mentorship-requests.ts; the approved student shows
 * in "Moji studenti" through teacher.mentorships.get.
 *
 * Every state is the server's answer (B-6): nothing is "sent", "withdrawn" or
 * "approved" before the answer names the same request. The reason of a
 * decline is kept by the server only and is never part of these shapes
 * (P-6); an answer that carries one is a broken contract, not a display.
 *
 * TODO(ugovor): the three routes are not in @ductura/contracts yet. Until
 * they are, the shapes are local (the smallest contract the plan and the
 * prototype give), the caller passes the transport (`StudentMentorshipCall`)
 * and createApi answers "client_rejected" to them, so the page says
 * "unavailable", never "no requests".
 */

import { matchesSchema, type Schema } from "./schema-check";

export type StudentMentorshipCall = (
  id: "student.mentorship-requests.get" | "student.mentorship-request.post" | "student.mentorship-request-withdraw.post",
  input: { readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type MentorshipWorkType = "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis";
export type MentorshipStatus = "pending" | "approved" | "declined" | "withdrawn";

export type StudentMentorshipRequest = {
  readonly requestId: string;
  readonly title: string;
  readonly workType: MentorshipWorkType;
  readonly status: MentorshipStatus;
  readonly requestedAt: string;
  /** Null while pending. */
  readonly decidedAt: string | null;
};

export type NewRequest = { readonly title: string; readonly workType: MentorshipWorkType };

export const TITLE_MAX = 256;
export const WORK_TYPES: readonly MentorshipWorkType[] = [
  "seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis",
];

export type MentorshipRead =
  | { readonly kind: "ready"; readonly requests: readonly StudentMentorshipRequest[] }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

export type SubmitOutcome =
  | { readonly kind: "poslano"; readonly request: StudentMentorshipRequest }
  /** 409: an open request for this work already exists. */
  | { readonly kind: "vec-postoji" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "invalid" }
  /** 408, 503, a broken connection, any other shape: the request may be recorded. */
  | { readonly kind: "nepoznato" };

export type WithdrawOutcome =
  | { readonly kind: "povuceno"; readonly requestId: string }
  /** 409: the teacher decided first; the list is read again. */
  | { readonly kind: "vec-odluceno" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const TEXT = { type: "string", minLength: 1, maxLength: TITLE_MAX } as const;
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const oneOf = (values: readonly string[]): Schema => ({ anyOf: values.map((v) => ({ const: v })) });
const STATUSES: readonly MentorshipStatus[] = ["pending", "approved", "declined", "withdrawn"];

// TODO(ugovor): local shapes until the routes are in the contract.
const REQUEST: Schema = closed({
  requestId: UUID,
  title: TEXT,
  workType: oneOf(WORK_TYPES),
  status: oneOf(STATUSES),
  requestedAt: { type: "string", format: "date-time" },
  decidedAt: { anyOf: [{ type: "null" }, { type: "string", format: "date-time" }] },
});
const LIST: Schema = closed({ requests: { type: "array", items: REQUEST } });
const SENT: Schema = closed({ request: REQUEST });
const WITHDRAWN: Schema = closed({ requestId: UUID, status: { const: "withdrawn" } });

/** The title as sent: trimmed; null when it is blank or longer than the contract allows (nothing is sent then). */
export function titleToSend(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" || trimmed.length > TITLE_MAX ? null : trimmed;
}

/** Only a pending request can be withdrawn. */
export function canWithdraw(request: StudentMentorshipRequest): boolean {
  return request.status === "pending";
}

/** student.mentorship-requests.get (TODO(ugovor)): the student's own requests, newest first as the server gives them. */
export async function readMyMentorshipRequests(call: StudentMentorshipCall): Promise<MentorshipRead> {
  try {
    const result = await call("student.mentorship-requests.get", {});
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { requests } = result.body as { requests: StudentMentorshipRequest[] };
    if (new Set(requests.map((r) => r.requestId)).size !== requests.length) return UNKNOWN;
    // A decided request has a time and a pending one has none; anything else is a broken answer.
    return requests.every((r) => (r.status === "pending") === (r.decidedAt === null)) ? { kind: "ready", requests } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** student.mentorship-request.post (TODO(ugovor)). Never throws. */
export async function submitMentorshipRequest(call: StudentMentorshipCall, input: NewRequest): Promise<SubmitOutcome> {
  const title = titleToSend(input.title);
  if (title === null || !WORK_TYPES.includes(input.workType)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("student.mentorship-request.post", { body: { title, workType: input.workType } });
    if (result.ok) {
      if (result.status !== 200 && result.status !== 201) return UNKNOWN;
      if (!matchesSchema(SENT, result.body)) return UNKNOWN;
      const { request } = result.body as { request: StudentMentorshipRequest };
      return request.status === "pending" && request.decidedAt === null && request.title === title && request.workType === input.workType
        ? { kind: "poslano", request }
        : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "vec-postoji" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** student.mentorship-request-withdraw.post (TODO(ugovor)). Never throws. */
export async function withdrawMentorshipRequest(call: StudentMentorshipCall, requestId: string): Promise<WithdrawOutcome> {
  if (!matchesSchema(UUID, requestId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("student.mentorship-request-withdraw.post", { body: { requestId } });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(WITHDRAWN, result.body)) return UNKNOWN;
      return (result.body as { requestId: string }).requestId === requestId ? { kind: "povuceno", requestId } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "vec-odluceno" };
    // Another student's, an unknown and a malformed id are the same 404.
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
