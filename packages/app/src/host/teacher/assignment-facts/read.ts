// The reads behind the N-01 task facts (WEB-2145): one teacher.course-students.get per course, then per
// assignment teacher.submissions.get, teacher.assignment-overview.get and teacher.deadline-extensions.get,
// all through createApi (`call`); NAS-R02 adds teacher.assignment-follow-up.get (notice acknowledgement and
// revision requests by student). The course read is what the facts stand on: when it fails the whole course
// is "unavailable", never empty. A failed assignment read only leaves its part out.
import type { createApi } from "../../../../../../src/client/api";
import { readDeadlineExtensions } from "../../../../../../src/client/deadline-extensions";
import type { AssignmentReads, Extension, StudentWork, SubmissionDetail } from "./model";

export type FactsCall = ReturnType<typeof createApi>;

export type CourseFactsRead =
  | { readonly kind: "ready"; readonly reads: ReadonlyMap<string, AssignmentReads> }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

type Assignment = { readonly id: string; readonly dueAt: string };
const none = { query: undefined, body: undefined } as const;

/** The submission facts of one assignment by student (also N-04, NZ-10); null when neither read answers. */
export async function details(call: FactsCall, assignmentId: string): Promise<ReadonlyMap<string, SubmissionDetail> | null> {
  const params = { assignmentId };
  const [subs, overview] = await Promise.all([
    call("teacher.submissions.get", { params, ...none }).catch(() => null),
    call("teacher.assignment-overview.get", { params, ...none }).catch(() => null),
  ]);
  const subsOk = subs?.ok === true ? subs.body.submissions : null;
  const overviewOk = overview?.ok === true ? overview.body.students : null;
  if (subsOk === null && overviewOk === null) return null;
  const map = new Map<string, SubmissionDetail>();
  for (const s of subsOk ?? []) {
    if (s.submitted) map.set(s.studentId, { requestedMinute: s.requestedMinute, afterDeadline: s.afterDeadline, revision: s.revision, record: null });
  }
  for (const o of overviewOk ?? []) {
    if (!o.submitted) continue;
    const known = map.get(o.studentId);
    map.set(o.studentId, {
      requestedMinute: known?.requestedMinute ?? o.requestedMinute,
      afterDeadline: known?.afterDeadline ?? o.afterDeadline,
      revision: known?.revision ?? null,
      record: o.evidenceRecord,
    });
  }
  return map;
}

/** The extensions of one assignment (also N-04, NZ-10); null when the read fails. */
export async function extensions(call: FactsCall, assignmentId: string): Promise<readonly Extension[] | null> {
  const read = await readDeadlineExtensions(call, assignmentId);
  return read.kind === "ready" ? read.extensions : null;
}

/** NAS-R02: what teacher.assignment-follow-up.get says of one student of one assignment. */
export type FollowUpStudent = {
  readonly studentId: string;
  /** null: the student has not acknowledged the notice (NAS-08). */
  readonly noticeAcknowledgedAt: string | null;
  readonly noticeReadAt: string | null;
  /** null: no revision was requested. `responded` waits for the teacher, not for the student. */
  readonly revisionState: "open" | "responded" | "closed" | "withdrawn" | null;
  readonly revisionChangedAt: string | null;
  readonly openRevisionCount: number;
};

export type FollowUp = ReadonlyMap<string, FollowUpStudent>;

/**
 * The follow-up of one assignment by student (NAS-08, NAS-10..12); null when the read fails or the answer
 * repeats a student: nothing is guessed, a missing read leaves the fields out ("nedostupno").
 */
export async function followUp(call: FactsCall, assignmentId: string): Promise<FollowUp | null> {
  const answer = await call("teacher.assignment-follow-up.get", { params: { assignmentId }, ...none }).catch(() => null);
  if (answer === null || !answer.ok) return null;
  const map = new Map<string, FollowUpStudent>();
  for (const s of answer.body.students) {
    if (map.has(s.studentId)) return null;
    map.set(s.studentId, {
      studentId: s.studentId, noticeAcknowledgedAt: s.noticeAcknowledgedAt, noticeReadAt: s.noticeReadAt,
      revisionState: s.revisionState, revisionChangedAt: s.revisionChangedAt, openRevisionCount: s.openRevisionCount,
    });
  }
  return map;
}

/** NAS-12: the number of open revision requests of the assignment ("Dorada: n otvorenih"); null when not read. */
export function openRevisions(read: FollowUp | null): number | null {
  if (read === null) return null;
  let total = 0;
  for (const s of read.values()) total += s.openRevisionCount;
  return total;
}

/** The reads of every assignment of one course, keyed by assignment id. */
export async function readCourseFacts(call: FactsCall, courseId: string, assignments: readonly Assignment[]): Promise<CourseFactsRead> {
  let roster;
  try {
    roster = await call("teacher.course-students.get", { params: { courseId }, ...none });
  } catch {
    return { kind: "unavailable" };
  }
  if (!roster.ok) return roster.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
  const students = roster.body.students;
  // A student, or one assignment of one student, twice is a contradiction: unavailable, as in N-04.
  const once = (ids: readonly string[]) => new Set(ids).size === ids.length;
  if (!once(students.map((s) => s.studentId)) || !students.every((s) => once(s.assignments.map((w) => w.assignmentId)))) {
    return { kind: "unavailable" };
  }
  const reads = new Map<string, AssignmentReads>();
  await Promise.all(assignments.map(async (a) => {
    const works: StudentWork[] = students.flatMap((s) => s.assignments.filter((w) => w.assignmentId === a.id).map((w) => ({
      studentId: s.studentId, givenName: s.givenName, familyName: s.familyName, state: w.workState, documentId: w.documentId,
    })));
    const [d, e] = await Promise.all([details(call, a.id), extensions(call, a.id)]);
    reads.set(a.id, { dueAt: a.dueAt, works, details: d, extensions: e });
  }));
  return { kind: "ready", reads };
}
