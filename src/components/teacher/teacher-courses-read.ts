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
