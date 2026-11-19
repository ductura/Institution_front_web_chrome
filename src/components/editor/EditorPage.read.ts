// WEB-14: what the editor page knows about one assignment before the editor
// opens, from two reads of the institution server (student.assignments.get and
// student.assignment-work.get). Pure: the page passes the two answers in.

/** The shape of a createApi answer this read needs; anything else is unavailable. */
type Answer<Body> = { readonly ok: true; readonly status: number; readonly body: Body } | { readonly ok: false; readonly status: number };

type AssignmentsBody = {
  readonly courses: readonly {
    readonly name: string;
    readonly assignments: readonly { readonly id: string; readonly title: string; readonly dueAt: string; readonly noticeFirst: boolean }[];
  }[];
};
type WorkBody = { readonly assignments: readonly { readonly assignmentId: string; readonly workState: string }[] };

export type WorkState = "not_started" | "in_progress" | "submitted";

export type EditorWorkRead =
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" }
  /** Not among the caller's assignments: foreign, unknown or not a student. */
  | { readonly kind: "notFound" }
  /** The current notice is not acknowledged yet: the work opens on the notice (PRODUCT §5 rule 6). */
  | { readonly kind: "noticeFirst" }
  | { readonly kind: "ready"; readonly course: string; readonly title: string; readonly dueAt: string; readonly workState: WorkState };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The assignment id of the path in the lowercase form both reads use, or null when it is not a UUID. */
export function assignmentIdOf(raw: string): string | null {
  const id = raw.toLowerCase();
  return UUID.test(id) ? id : null;
}

/**
 * One read of the page. A 401 from either read means signed out; any other
 * failure, or a work state the read does not name, is unavailable: the page
 * never guesses a state.
 */
export function editorWorkRead(assignmentId: string, assignments: Answer<AssignmentsBody>, work: Answer<WorkBody>): EditorWorkRead {
  if ((!assignments.ok && assignments.status === 401) || (!work.ok && work.status === 401)) return { kind: "signedOut" };
  if (!assignments.ok || assignments.status !== 200 || !work.ok || work.status !== 200) return { kind: "unavailable" };
  for (const course of assignments.body.courses) {
    const assignment = course.assignments.find((a) => a.id.toLowerCase() === assignmentId);
    if (assignment === undefined) continue;
    if (assignment.noticeFirst) return { kind: "noticeFirst" };
    const row = work.body.assignments.find((w) => w.assignmentId === assignmentId);
    if (row === undefined) return { kind: "unavailable" };
    const { workState } = row;
    if (workState !== "not_started" && workState !== "in_progress" && workState !== "submitted") return { kind: "unavailable" };
    return { kind: "ready", course: course.name, title: assignment.title, dueAt: assignment.dueAt, workState };
  }
  return { kind: "notFound" };
}
