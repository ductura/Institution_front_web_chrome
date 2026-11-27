// WEB-2113: the student host's own copy of src/components/student/my-assignments-read.ts
// (the shape of student.assignments.get and its one read). The page passes
// createApi() in, so this file needs no import of src/client.
export type MyAssignment = {
  id: string;
  title: string;
  dueAt: string;
  /** The current version's notice is not acknowledged yet; /rad opens it first. */
  noticeFirst: boolean;
  /** WEB-09 (A-3): a later deadline the teacher gave this student; null or absent: none. */
  extendedDueAt?: string | null;
  /** WEB-2102: the kind of work as the contract gives it; absent: not given. */
  workType?: "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis";
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
  /** DIZ S-02 (Z7, R8): 403 is its own state, not a read error. */
  | { kind: "denied" }
  | { kind: "unavailable" };

/** What MyAssignments needs of createApi(): one route, its answers only. */
export type AssignmentsCall = (
  id: "student.assignments.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<{ ok: true; status: 200; body: { courses: MyCourse[] } } | { ok: false; status: number; code: string }>;

/**
 * One call of student.assignments.get. 200 is the list as it came (createApi
 * already checked it against the schema), 401 signed out, 403 denied, and everything else
 * unavailable, a broken connection included: never an empty or older list.
 */
export async function readMyAssignments(call: AssignmentsCall): Promise<MyAssignmentsRead> {
  try {
    const result = await call("student.assignments.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready", courses: result.body.courses };
    if (result.status === 401) return { kind: "signedOut" };
    return result.status === 403 ? { kind: "denied" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
