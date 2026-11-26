// The real port of N-04 "Popis studenata" (PIL-K-N04): teacher.course-students.get through createApi
// (src/client; the answer is checked against the contract there), and teacher.courses.get for the course
// name and the title and type of each assignment. A field neither route gives (time, version, record,
// revision) is left out, never invented. The roster is what the screen stands on: when it fails the screen
// is "unavailable"; a failed course read only leaves the names out. A student, or one assignment of one
// student, twice is caught by loadRoster (model.ts) and reads "unavailable".
// readCourseStudents (src/client/teacher-reads.ts) still holds the local shape of WEB-30 and rejects
// every answer of the contract, so this port reads the route as assignment-facts/read.ts does.
import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/teacher/teacher-courses-read";
import { deadlineOf, type Extension, type SubmissionDetail } from "../assignment-facts/model";
import { details, extensions, followUp, type FollowUp, type FollowUpStudent } from "../assignment-facts/read";
import { rosterPath, workStatusOf, type CourseStudentsPort, type RosterRead, type RosterWork, type WorkStatus } from "./model";

export type RosterCall = ReturnType<typeof createApi>;
const none = { query: undefined, body: undefined } as const;

async function roster(call: RosterCall, courseId: string) {
  try {
    return await call("teacher.course-students.get", { params: { courseId }, ...none });
  } catch {
    return null;
  }
}

type AssignmentFacts = {
  readonly dueAt: string;
  readonly details: ReadonlyMap<string, SubmissionDetail> | null;
  readonly extensions: readonly Extension[] | null;
  /** NAS-R02: teacher.assignment-follow-up.get by student; null when it was not read. */
  readonly followUp?: FollowUp | null;
};

/** NAS-10: an open request still waits for the student whatever the state of the last one (`openRevisionCount`). */
function revisionOf(follow: FollowUpStudent): RosterWork["revision"] {
  if (follow.openRevisionCount > 0) return { state: "open", deadline: null };
  return follow.revisionState === null ? null : { state: follow.revisionState, deadline: null };
}

/** NZ-10: the fields of one work the reads give; a part that was not read is left out, never guessed. */
export function factsOf(facts: AssignmentFacts | undefined, studentId: string): Partial<RosterWork> {
  if (facts === undefined) return {};
  const detail = facts.details?.get(studentId);
  const deadline = facts.extensions === null ? null : deadlineOf(studentId, facts.dueAt, facts.extensions);
  const follow = facts.followUp?.get(studentId);
  return {
    // NAS-10/NAS-11: the revision column and its filter come from the server; it gives no revision deadline.
    ...(follow === undefined ? {} : { revision: revisionOf(follow) }),
    ...(detail === undefined ? {} : {
      submittedAt: detail.requestedMinute,
      ...(detail.afterDeadline === null ? {} : { afterDeadline: detail.afterDeadline }),
      version: detail.revision,
      record: detail.record,
    }),
    ...(deadline === null ? {} : { extendedTo: deadline.extended ? deadline.dueAt : null }),
  };
}

/** NAS-08: a work not yet submitted whose notice the student has not acknowledged is "obavijest nije potvrđena". */
function unconfirmedWhenNotAcknowledged(status: WorkStatus, follow: { readonly noticeAcknowledgedAt: string | null } | undefined): WorkStatus {
  return status === "not_submitted" && follow !== undefined && follow.noticeAcknowledgedAt === null ? "unconfirmed" : status;
}

export function courseStudentsPort(client: () => RosterCall = () => createApi()): CourseStudentsPort {
  return {
    async read(courseId): Promise<RosterRead> {
      const call = client();
      const [answer, courses] = await Promise.all([
        roster(call, courseId),
        readTeacherCourses(call as unknown as TeacherCoursesCall),
      ]);
      if (answer === null) return { kind: "unavailable" };
      if (!answer.ok) return answer.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
      const course = courses.kind === "ready" ? courses.courses.find((c) => c.id === courseId) : undefined;
      const assignments = new Map((course?.assignments ?? []).map((a) => [a.id, a]));
      // NZ-10: per assignment the submission facts (time, version, record) and the extensions; a read that
      // fails leaves its fields out, as before.
      const facts = new Map(await Promise.all([...assignments.values()].map(async (a) => {
        const [d, e, f] = await Promise.all([details(call, a.id).catch(() => null), extensions(call, a.id).catch(() => null), followUp(call, a.id)]);
        return [a.id, { dueAt: a.dueAt, details: d, extensions: e, followUp: f }] as const;
      })));
      return {
        kind: "ready",
        data: {
          ...(course === undefined ? {} : { courseName: course.name }),
          students: answer.body.students.map((s) => ({
            studentId: s.studentId,
            name: s.givenName === null ? null : `${s.givenName} ${s.familyName}`,
            group: s.groupName,
            works: s.assignments.map((w): RosterWork => ({
              assignmentId: w.assignmentId,
              title: assignments.get(w.assignmentId)?.title ?? null,
              workType: assignments.get(w.assignmentId)?.workType ?? null,
              status: unconfirmedWhenNotAcknowledged(workStatusOf(w.workState), facts.get(w.assignmentId)?.followUp?.get(s.studentId)),
              documentId: w.documentId,
              ...factsOf(facts.get(w.assignmentId), s.studentId),
            })),
          })),
        },
      };
    },
  };
}

/** A signed-out read goes to AAI@EduHr sign-in and comes back to this course's roster. */
export function signInWhenSignedOut(read: RosterRead, base: string, courseId: string, leave?: (href: string) => void): void {
  if (read.kind === "signedOut") goToSignIn(appHref(base, rosterPath(courseId)), leave);
}
