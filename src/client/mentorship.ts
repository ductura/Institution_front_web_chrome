/**
 * Mentorship from the student's side (WEB-1404, WEB-2002; plan M2, D-204): the
 * student asks a teacher to mentor a work, sees the request as requested,
 * approved or declined, and may withdraw it until it is decided. The teacher's
 * side (list and decision) is mentorship-requests.ts; the approved student
 * shows in "Moji studenti" through teacher.mentorships.get.
 *
 * Operations of the server contract (migration-contract extract, API 1.75.0):
 * mentorship.student-mentor-candidates.get, mentorship.student-requests.get,
 * mentorship.requests.post {teacherId, workType} and
 * mentorship.request-withdraw.post (requestId in the path). The paths live in the contract.
 *
 * Every state is the server's answer (B-6): nothing is "sent", "withdrawn" or
 * "approved" before the answer names the same request. The reason of a decline
 * is kept by the server only and is never part of these shapes (P-6). A
 * transport that answers anything the contract does not allow is "nepoznato",
 * never an empty list. The default transport is createApi, in the client entry file, which
 * validates every answer against the contract.
 */

import { createApi, type ApiOptions } from "./api";

type Failure = { ok: false; status: number; code: string };
export type StudentMentorshipCall = (
  id: "mentorship.student-requests.get" | "mentorship.requests.post" | "mentorship.request-withdraw.post" | "mentorship.student-mentor-candidates.get",
  input: { readonly params?: { readonly requestId: string }; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | Failure>;

/** The student's transport: the four contract routes through createApi. */
export function studentMentorshipCall(options: ApiOptions = {}): StudentMentorshipCall {
  const api = createApi(options) as unknown as (
    id: string, input: { params: unknown; query: undefined; body: unknown },
  ) => Promise<{ ok: true; status: number; body: unknown } | Failure>;
  return (id, input) => api(id, { params: input.params, query: undefined, body: input.body });
}

/** The work types the contract lets a student ask for (a seminar paper has no mentor). */
export type MentorshipWorkType = "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis";
export type MentorshipState = "requested" | "approved" | "declined" | "withdrawn";
export type PersonName = { readonly givenName: string; readonly familyName: string };

export type StudentMentorshipRequest = {
  readonly requestId: string;
  readonly teacherId: string;
  /** Null when the server holds no name for the teacher. */
  readonly teacherName: PersonName | null;
  readonly workType: MentorshipWorkType;
  readonly state: MentorshipState;
  readonly requestedAt: string;
  /** Null while requested. */
  readonly endedAt: string | null;
  /** Set only on an approved request. */
  readonly mentorshipId: string | null;
};

export type NewRequest = { readonly workType: MentorshipWorkType; readonly teacherId: string };

/** A teacher the student may ask (mentorship.student-mentor-candidates.get). */
export type MentorCandidate = { readonly teacherId: string; readonly name: PersonName | null; readonly department: string | null };

export type CandidatesRead =
  | { readonly kind: "ready"; readonly candidates: readonly MentorCandidate[] }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

export const WORK_TYPES: readonly MentorshipWorkType[] = ["bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"];
const STATES: readonly MentorshipState[] = ["requested", "approved", "declined", "withdrawn"];

export type MentorshipRead =
  | { readonly kind: "ready"; readonly requests: readonly StudentMentorshipRequest[] }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

export type SubmitOutcome =
  | { readonly kind: "poslano"; readonly requestId: string }
  /** 409: an open request for this teacher and work type already exists. */
  | { readonly kind: "vec-postoji" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "invalid" }
  /** 404: the teacher is not a candidate (any more); the candidates are read again. */
  | { readonly kind: "nepoznat-nastavnik" }
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isName = (value: unknown): value is PersonName | null =>
  value === null || (isRecord(value) && typeof value.givenName === "string" && typeof value.familyName === "string");
const isTime = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

/** "Given Family"; null when the server holds no name. */
export function nameText(name: PersonName | null): string | null {
  if (name === null) return null;
  const text = `${name.givenName} ${name.familyName}`.trim();
  return text === "" ? null : text;
}

/** Only a requested one can be withdrawn. */
export function canWithdraw(request: StudentMentorshipRequest): boolean {
  return request.state === "requested";
}

function parseRequest(value: unknown): StudentMentorshipRequest | null {
  if (!isRecord(value)) return null;
  const { requestId, teacherId, teacherName, workType, state, requestedAt, endedAt, mentorshipId } = value;
  if (!isUuid(requestId) || !isUuid(teacherId) || !isName(teacherName) || !isTime(requestedAt)) return null;
  if (!WORK_TYPES.includes(workType as MentorshipWorkType) || !STATES.includes(state as MentorshipState)) return null;
  // A requested one has no end, a decided one has; only an approved one has a mentorship (P-6: no reason here).
  if ((state === "requested") !== (endedAt === null) || (endedAt !== null && !isTime(endedAt))) return null;
  if ((state === "approved") !== (mentorshipId !== null) || (mentorshipId !== null && !isUuid(mentorshipId))) return null;
  return { requestId, teacherId, teacherName, workType: workType as MentorshipWorkType, state: state as MentorshipState, requestedAt, endedAt: endedAt as string | null, mentorshipId: mentorshipId as string | null };
}

/** mentorship.student-requests.get: the student's own requests, in the server's order. */
export async function readMyMentorshipRequests(call: StudentMentorshipCall): Promise<MentorshipRead> {
  try {
    const result = await call("mentorship.student-requests.get", {});
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !isRecord(result.body) || !Array.isArray(result.body.requests)) return UNKNOWN;
    const requests = result.body.requests.map(parseRequest);
    if (requests.some((r) => r === null)) return UNKNOWN;
    const ready = requests as StudentMentorshipRequest[];
    return new Set(ready.map((r) => r.requestId)).size === ready.length ? { kind: "ready", requests: ready } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** mentorship.student-mentor-candidates.get: the teachers the student may ask, each once. */
export async function readMentorCandidates(call: StudentMentorshipCall): Promise<CandidatesRead> {
  try {
    const result = await call("mentorship.student-mentor-candidates.get", {});
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !isRecord(result.body) || !Array.isArray(result.body.candidates)) return UNKNOWN;
    const candidates: MentorCandidate[] = [];
    for (const item of result.body.candidates as unknown[]) {
      if (!isRecord(item) || !isUuid(item.teacherId) || !isName(item.name) || (item.department !== null && typeof item.department !== "string")) return UNKNOWN;
      candidates.push({ teacherId: item.teacherId, name: item.name, department: item.department });
    }
    return new Set(candidates.map((c) => c.teacherId)).size === candidates.length ? { kind: "ready", candidates } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** mentorship.requests.post. Never throws. */
export async function submitMentorshipRequest(call: StudentMentorshipCall, input: NewRequest): Promise<SubmitOutcome> {
  if (!WORK_TYPES.includes(input.workType) || !isUuid(input.teacherId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("mentorship.requests.post", { body: { teacherId: input.teacherId, workType: input.workType } });
    if (result.ok) {
      if (result.status !== 201 || !isRecord(result.body)) return UNKNOWN;
      return isUuid(result.body.requestId) && result.body.state === "requested" ? { kind: "poslano", requestId: result.body.requestId } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "vec-postoji" };
    if (result.status === 404) return { kind: "nepoznat-nastavnik" };
    if (result.status === 400 || result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** mentorship.request-withdraw.post. Never throws. */
export async function withdrawMentorshipRequest(call: StudentMentorshipCall, requestId: string): Promise<WithdrawOutcome> {
  if (!isUuid(requestId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("mentorship.request-withdraw.post", { params: { requestId } });
    if (result.ok) {
      if (result.status !== 200 || !isRecord(result.body)) return UNKNOWN;
      return result.body.requestId === requestId && result.body.state === "withdrawn" ? { kind: "povuceno", requestId } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "vec-odluceno" };
    // Another student's, an unknown and a malformed id are the same 404.
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 400 || result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
