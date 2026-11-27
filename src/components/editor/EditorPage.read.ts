// WEB-14: what the editor page knows about one assignment before the editor
// opens, from two reads of the institution server (student.assignments.get and
// student.assignment-work.get). Pure: the page passes the two answers in.

/** The shape of a createApi answer this read needs; anything else is unavailable. */
type Answer<Body> = { readonly ok: true; readonly status: number; readonly body: Body } | { readonly ok: false; readonly status: number };

type AssignmentsBody = {
  readonly courses: readonly {
    readonly name: string;
    readonly assignments: readonly {
      readonly id: string; readonly title: string; readonly dueAt: string; readonly noticeFirst: boolean;
      readonly extendedDueAt?: string | null; readonly workType?: string;
    }[];
  }[];
};
type WorkBody = { readonly assignments: readonly { readonly assignmentId: string; readonly workState: string }[] };

export type WorkState = "not_started" | "in_progress" | "submitted";

export type EditorWorkRead =
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" }
  /** S-08 X1: the server refused the read (403); the page says so and offers the way back, it is not a read error. */
  | { readonly kind: "denied" }
  /** Not among the caller's assignments: foreign, unknown or not a student. */
  | { readonly kind: "notFound" }
  /** The current notice is not acknowledged yet: the work opens on the notice (PRODUCT §5 rule 6). */
  | { readonly kind: "noticeFirst" }
  | {
    readonly kind: "ready"; readonly course: string; readonly title: string; readonly dueAt: string; readonly workState: WorkState;
    /** A later deadline the teacher gave this student; absent: none. */
    readonly extendedDueAt?: string;
    /** The kind of work as the contract gives it (`essay`); absent when the read does not give it. */
    readonly workType?: string;
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The assignment id of the path in the lowercase form both reads use, or null when it is not a UUID. */
export function assignmentIdOf(raw: string): string | null {
  const id = raw.toLowerCase();
  return UUID.test(id) ? id : null;
}

/**
 * One read of the page. A 401 from either read means signed out; any other
 * failure, or a work state the read does not name, is unavailable: the page
 * never guesses a state. With `refusals` (the submission steps, S-08 X1 and
 * X2, and the workspace pages since the design alignment of 27. 11. 2026.)
 * a 403 is "denied" and a 404 is "notFound": neither is a read error.
 * The other pages keep reading both as unavailable until their own screens
 * take the refusals over.
 */
export function editorWorkRead(assignmentId: string, assignments: Answer<AssignmentsBody>, work: Answer<WorkBody>, options: { readonly refusals: true }): EditorWorkRead;
export function editorWorkRead(assignmentId: string, assignments: Answer<AssignmentsBody>, work: Answer<WorkBody>, options?: { readonly refusals?: false }): Exclude<EditorWorkRead, { kind: "denied" }>;
export function editorWorkRead(assignmentId: string, assignments: Answer<AssignmentsBody>, work: Answer<WorkBody>, options?: { readonly refusals?: boolean }): EditorWorkRead {
  if ((!assignments.ok && assignments.status === 401) || (!work.ok && work.status === 401)) return { kind: "signedOut" };
  if (options?.refusals === true) {
    const statuses = [assignments, work].map((answer) => (answer.ok ? 200 : answer.status));
    if (statuses.includes(403)) return { kind: "denied" };
    if (statuses.includes(404)) return { kind: "notFound" };
  }
  if (!assignments.ok || assignments.status !== 200 || !work.ok || work.status !== 200) return { kind: "unavailable" };
  for (const course of assignments.body.courses) {
    const assignment = course.assignments.find((a) => a.id.toLowerCase() === assignmentId);
    if (assignment === undefined) continue;
    if (assignment.noticeFirst) return { kind: "noticeFirst" };
    const row = work.body.assignments.find((w) => w.assignmentId === assignmentId);
    if (row === undefined) return { kind: "unavailable" };
    const { workState } = row;
    if (workState !== "not_started" && workState !== "in_progress" && workState !== "submitted") return { kind: "unavailable" };
    // The extended deadline and the kind of work only when the read gives them.
    const extended = assignment.extendedDueAt;
    return {
      kind: "ready", course: course.name, title: assignment.title, dueAt: assignment.dueAt, workState,
      ...(typeof extended === "string" && extended !== "" ? { extendedDueAt: extended } : {}),
      ...(assignment.workType === undefined ? {} : { workType: assignment.workType }),
    };
  }
  return { kind: "notFound" };
}

/**
 * ED-01b: why the frame could not read the work. No answer from either read is
 * the network; any other unusable answer is the server's. Signed out and not
 * found never reach here: the page leaves for the sign-in or the 404.
 */
export function frameFailureOf(assignments: { readonly status: number }, work: { readonly status: number }): "offline" | "server" {
  return assignments.status === 0 || work.status === 0 ? "offline" : "server";
}