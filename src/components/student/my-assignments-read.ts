// The shape of Ductus src/components/student/my-assignments-read.ts at 078c780f
// (DAN-753), and the read of student.assignments.get (DAN-876). No import: the
// call is createApi() from src/client, which the page passes in, so this file
// also type-checks inside src/client, whose test runs it over the fake server.

export type MyAssignment = {
  id: string;
  title: string;
  dueAt: string;
  /** The current version's notice is not acknowledged yet; /rad opens it first. */
  noticeFirst: boolean;
  /** WEB-09 (A-3): a later deadline the teacher gave this student; null or absent: none. */
  extendedDueAt?: string | null;
};

/** WEB-09 (A-3): a teacher of the course as student.assignments.get names them. */
export type CourseTeacher = { id: string; givenName: string; familyName: string; role: "holder" | "collaborator" };

export type MyCourse = {
  id: string;
  name: string;
  academicYear?: string;
  teachers?: CourseTeacher[];
  assignments: MyAssignment[];
};

export type MyAssignmentsRead =
  | { kind: "ready"; courses: MyCourse[] }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

/** What MyAssignments needs of createApi(): one route, its answers only. */
export type AssignmentsCall = (
  id: "student.assignments.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<{ ok: true; status: 200; body: { courses: MyCourse[] } } | { ok: false; status: number; code: string }>;

/**
 * One call of student.assignments.get. 200 is the list as it came (createApi
 * already checked it against the schema), 401 signed out, and everything else
 * unavailable, a broken connection included: never an empty or older list.
 */
export async function readMyAssignments(call: AssignmentsCall): Promise<MyAssignmentsRead> {
  try {
    const result = await call("student.assignments.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready", courses: result.body.courses };
    return result.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
