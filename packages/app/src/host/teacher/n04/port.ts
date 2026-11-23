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
import { rosterPath, workStatusOf, type CourseStudentsPort, type RosterRead, type RosterWork } from "./model";

export type RosterCall = ReturnType<typeof createApi>;
const none = { query: undefined, body: undefined } as const;

async function roster(call: RosterCall, courseId: string) {
  try {
    return await call("teacher.course-students.get", { params: { courseId }, ...none });
  } catch {
    return null;
  }
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
              status: workStatusOf(w.workState),
              documentId: w.documentId,
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
