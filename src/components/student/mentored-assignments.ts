// INT-31: a mentorship's assignment (a thesis) has no course, so
// student.assignments.get never names it; student.mentored-assignments.get
// does. The pages that find an assignment by its id, and the list of the
// student's assignments, read both and see the mentored works as one more
// group after the courses. Pure but for the two calls the page passes in.

import type { ApiResult } from "../../client/api";
import { messagesHr as t } from "../../lib/i18n/messages.hr";

type Route = "student.assignments.get" | "student.mentored-assignments.get";
type None = { params: undefined; query: undefined; body: undefined };
const NONE: None = { params: undefined, query: undefined, body: undefined };

/** The two reads, as createApi() or serverApi() gives them. */
export type AssignmentsApi = <Id extends Route>(id: Id, input: None) => Promise<ApiResult<Id>>;

type Assignments = ApiResult<"student.assignments.get">;
type Mentored = ApiResult<"student.mentored-assignments.get">;

/** The id of the group of mentored works; no course has it (course ids are UUIDs). */
export const MENTORED_GROUP_ID = "mentorstvo";

const UNREACHED = { ok: false, status: 0, code: "unexpected" } as const;

/**
 * The answer of student.assignments.get with the mentored works added as a
 * group named "Radovi uz mentora". A failed course read is the answer as it
 * came. A failed mentored read is the whole answer's failure (401 signed out,
 * else unavailable): the page never shows a list that may lack a work. Only a
 * 404, a server without the route yet, leaves the course list as it is.
 */
export function withMentored(assignments: Assignments, mentored: Mentored): Assignments {
  if (!assignments.ok) return assignments;
  // Both routes share their error codes ("unauthorized", "unavailable" and the shared ones).
  if (!mentored.ok) return mentored.status === 404 ? assignments : ({ ok: false, status: mentored.status, code: mentored.code } as Assignments);
  if (mentored.body.assignments.length === 0) return assignments;
  const group = {
    id: MENTORED_GROUP_ID,
    name: t.student.assignments.mentoredGroup,
    assignments: mentored.body.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      dueAt: a.dueAt,
      noticeFirst: a.noticeFirst,
      workType: a.workType,
      mentor: a.mentor,
      extendedDueAt: a.extendedDueAt,
    })),
  };
  return { ...assignments, body: { courses: [...assignments.body.courses, group] } };
}

/** Both reads at once; a server that cannot be reached is status 0, never a throw. */
export async function readAssignmentsWithMentored(call: AssignmentsApi): Promise<Assignments> {
  const [assignments, mentored] = await Promise.all([
    call("student.assignments.get", NONE).catch(() => UNREACHED),
    call("student.mentored-assignments.get", NONE).catch(() => UNREACHED),
  ]);
  return withMentored(assignments, mentored);
}

/** The same, as the one-route call readMyAssignments() takes: the list of "Moji zadaci" names the mentored works too. */
export function withMentoredCall(call: AssignmentsApi): (id: "student.assignments.get", input: None) => Promise<Assignments> {
  return () => readAssignmentsWithMentored(call);
}

/**
 * createApi() as it was, except that student.assignments.get also names the
 * mentored works: the host pages (packages/app) that find an assignment by id
 * or list the student's works change one line, never their reading.
 */
export function withMentoredAssignments<Call extends (id: never, input: never) => Promise<unknown>>(call: Call): Call {
  const forward = call as unknown as (id: string, input: unknown) => Promise<unknown>;
  return ((id: string, input: unknown) =>
    id === "student.assignments.get" ? readAssignmentsWithMentored(call as unknown as AssignmentsApi) : forward(id, input)) as unknown as Call;
}
