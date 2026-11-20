/**
 * Where the assignment stands for step 3 (WEB-25), from student.assignments.get
 * and student.assignment-work.get. A plain module, not "use client": the
 * server page calls `stageOf`, and an export of a client module reaches the
 * server only as a client reference.
 */
export type Stage =
  | { readonly kind: "open" }
  | { readonly kind: "closed"; readonly dueAt: string }
  | { readonly kind: "submitted" }
  | { readonly kind: "unavailable" };

/** The stage of a work: submitted first, then the deadline against `now`. */
export function stageOf(workState: string, dueAt: string, now: number): Stage {
  if (workState === "submitted") return { kind: "submitted" };
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && due < now ? { kind: "closed", dueAt } : { kind: "open" };
}
