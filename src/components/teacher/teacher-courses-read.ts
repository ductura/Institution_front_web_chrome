// The shapes of Ductus src/server/institution/teacher-courses.ts and
// src/server/evidence/assignment-submissions.ts at 9c45857 (DAN-871, 871-1):
// the types only, as the contract's teacher.courses.get gives a course. The
// read itself comes through src/client in 871-4; the page passes it in.

export type CourseAiPolicy = "prohibited" | "partially_allowed" | "encouraged";

export interface TeacherAssignment {
  id: string;
  title: string;
  workType: string;
  opensAt: string;
  dueAt: string;
  currentVersion: number;
  enrolledStudents: number;
}

export interface TeacherCourse {
  id: string;
  name: string;
  academicYear: string;
  aiPolicy: CourseAiPolicy;
  assignments: TeacherAssignment[];
}

export interface AssignmentSubmission {
  studentId: string;
  /** The student's work, null while there is none. */
  documentId: string | null;
  submitted: boolean;
  /** These three are null exactly when submitted is false. */
  revision: number | null;
  /** ISO UTC, always on a whole minute. */
  requestedMinute: string | null;
  afterDeadline: boolean | null;
}

export type TeacherCoursesRead =
  | { kind: "ready"; courses: TeacherCourse[] }
  | { kind: "signedOut" }
  | { kind: "notTeacher" }
  | { kind: "unavailable" };

/** What the page needs of createApi(): teacher.courses.get, its answers only. */
export type TeacherCoursesCall = (
  id: "teacher.courses.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<{ ok: true; status: 200; body: { courses: TeacherCourse[] } } | { ok: false; status: number; code: string }>;

/**
 * One call of teacher.courses.get (#2028, after 871-4). 200 is the list as it
 * came (createApi already checked it against the schema), 401 signed out, 403
 * an account without the teacher role, and everything else unavailable, a
 * broken connection included: never an empty or older list.
 */
export async function readTeacherCourses(call: TeacherCoursesCall): Promise<TeacherCoursesRead> {
  try {
    const result = await call("teacher.courses.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready", courses: result.body.courses };
    if (result.status === 401) return { kind: "signedOut" };
    return result.status === 403 ? { kind: "notTeacher" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
