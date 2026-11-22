import { assignmentIdOf } from "../../../../../../src/components/editor/EditorPage.read.ts";

// WEB-2105: what "/rad" (the nav item "Radni prostor", E-7) does with the two
// reads of the server. Pure: the page passes the answers in.
type Answer<Body> = { readonly ok: true; readonly status: number; readonly body: Body } | { readonly ok: false; readonly status: number };
type AssignmentsBody = {
  readonly courses: readonly {
    readonly name: string;
    readonly assignments: readonly { readonly id: string; readonly title: string; readonly dueAt: string; readonly noticeFirst: boolean }[];
  }[];
};
type WorkBody = { readonly assignments: readonly { readonly assignmentId: string; readonly workState: string }[] };

export type WorkItem = { readonly id: string; readonly title: string; readonly course: string; readonly dueAt: string };

export type IndexRead =
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" }
  /** One place to go: `?zadatak=<id>` (the notice's link), or the only work in progress. */
  | { readonly kind: "go"; readonly assignmentId: string }
  | { readonly kind: "list"; readonly items: readonly WorkItem[] }
  | { readonly kind: "empty" };

/**
 * `?zadatak=` names the work to open, and nothing else decides then (a bad id
 * is simply not used). Otherwise the works in progress whose notice is
 * acknowledged: none → empty, one → straight to it, several → a list.
 * A failed read is never turned into "no work" (B-6).
 */
export function indexRead(assignments: Answer<AssignmentsBody>, work: Answer<WorkBody>, zadatak: string | null): IndexRead {
  if ((!assignments.ok && assignments.status === 401) || (!work.ok && work.status === 401)) return { kind: "signedOut" };
  if (!assignments.ok || assignments.status !== 200 || !work.ok || work.status !== 200) return { kind: "unavailable" };
  const named = zadatak === null ? null : assignmentIdOf(zadatak);
  if (named !== null) return { kind: "go", assignmentId: named };
  const started = new Set(work.body.assignments.filter((w) => w.workState === "in_progress").map((w) => w.assignmentId.toLowerCase()));
  const items: WorkItem[] = [];
  for (const course of assignments.body.courses) {
    for (const a of course.assignments) {
      if (started.has(a.id.toLowerCase()) && !a.noticeFirst) items.push({ id: a.id.toLowerCase(), title: a.title, course: course.name, dueAt: a.dueAt });
    }
  }
  if (items.length === 0) return { kind: "empty" };
  return items.length === 1 ? { kind: "go", assignmentId: items[0]!.id } : { kind: "list", items };
}
