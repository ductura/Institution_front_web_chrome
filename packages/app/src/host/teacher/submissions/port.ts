// PIL-D2-PREDAJE: the real port of the teacher's submissions screen, over the contract client
// (src/client/teacher-submissions.ts, routes teacher.submissions.get and teacher.submission-detail.get).
// No network primitive here: the transport is createApi's, passed in by the page.
import {
  submissionsPort, type SubmissionsCall, type TeacherSubmissionsPort,
} from "../../../../../../src/client/teacher-submissions.ts";

/**
 * A refusal (403) reads as "not found" (404): another teacher's or a student's request learns
 * nothing about the assignment, not even that it exists, and no row is ever shown with it.
 */
export function refusalAsNotFound(call: SubmissionsCall): SubmissionsCall {
  return async (id, input) => {
    const result = await call(id, input);
    return !result.ok && result.status === 403 ? { ok: false, status: 404, code: "not_found" } : result;
  };
}

/** The port over a transport; an ended session calls `onExpired` once per read that found it. */
export function clientSubmissionsPort(call: SubmissionsCall, onExpired: () => void): TeacherSubmissionsPort {
  const port = submissionsPort(refusalAsNotFound(call));
  const guard = <T extends { kind: string }>(read: T): T => {
    if (read.kind === "session-expired") onExpired();
    return read;
  };
  return {
    list: async (assignmentId) => guard(await port.list(assignmentId)),
    open: async (assignmentId, studentId) => guard(await port.open(assignmentId, studentId)),
  };
}

/** The page of the submissions of one assignment, without the base. */
export const submissionsHref = (assignmentId: string): string => `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/predaje`;
