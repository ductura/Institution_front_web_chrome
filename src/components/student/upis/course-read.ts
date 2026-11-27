import type { createApi } from "@/client/api";

// WEB-11 (PRODUCT §5 rule 6): after the enrollment the student goes straight
// to the notice of the course's open assignment. The enrollment answers only
// the course, so the page reads student.assignments.get (the student's own
// courses, as the server allows) and picks the assignment here.
export type CourseRead =
  | { kind: "assignment"; assignmentId: string }
  | { kind: "none" | "signedOut" | "denied" | "notFound" | "unavailable" };

type Api = ReturnType<typeof createApi>;

export interface AssignmentDue {
  id: string;
  dueAt: string;
  extendedDueAt?: string | null;
}

/**
 * The nearest assignment not yet past its due date (an extended date counts);
 * ties go to the id, so the choice never depends on order. Null when none is open.
 */
export function pickOpenAssignment(rows: readonly AssignmentDue[], now: Date): string | null {
  const open = rows
    .map((row) => ({ id: row.id, due: Date.parse(row.extendedDueAt ?? row.dueAt) }))
    .filter((row) => Number.isFinite(row.due) && row.due > now.getTime());
  open.sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return open[0]?.id ?? null;
}

/** Where the enrollment form goes with the course from the enrollment reply. */
export function courseHref(courseId: string): string {
  return `/upis/kolegij/${encodeURIComponent(courseId)}`;
}

/** The notice of an assignment (E-6, WEB-12). */
export function noticeHref(assignmentId: string): string {
  return `/zadatak/${encodeURIComponent(assignmentId)}`;
}

export async function readCourse(api: Api, courseId: string, now: Date = new Date()): Promise<CourseRead> {
  let result: Awaited<ReturnType<Api>>;
  try {
    result = await api("student.assignments.get", { params: undefined, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) {
    if (result.status === 401) return { kind: "signedOut" };
    // Design alignment 27. 11. 2026. (KU4): 403 is not a read error; the page shows the denied state.
    return result.status === 403 ? { kind: "denied" } : { kind: "unavailable" };
  }
  const { courses } = result.body as { courses: { id: string; assignments: AssignmentDue[] }[] };
  // Only a course the student is enrolled in is listed; anything else is not theirs.
  const course = courses.find((item) => item.id === courseId);
  if (!course) return { kind: "notFound" };
  const id = pickOpenAssignment(course.assignments, now);
  return id ? { kind: "assignment", assignmentId: id } : { kind: "none" };
}
