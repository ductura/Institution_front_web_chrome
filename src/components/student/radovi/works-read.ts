// WEB-10 (S: E-4 "Moji radovi", A-10): the student's works over /api/v1. The
// courses and assignments come from student.assignments.get, as on /zadaci;
// the state of each work from student.assignment-work.get. No import of
// src/client: the page passes createApi() in, as MyAssignments' read does.
import { readMyAssignments, type AssignmentsCall, type MyAssignmentsRead } from "../my-assignments-read";

/** A work's state as student.assignment-work.get gives it. */
export type WorkState = "not_started" | "in_progress" | "submitted";

/** What the works read needs of createApi(): two routes, their answers only. */
export type WorkStatesCall = (
  id: "student.assignment-work.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<
  | { ok: true; status: 200; body: { assignments: { assignmentId: string; workState: WorkState }[] } }
  | { ok: false; status: number; code: string }
>;

export type WorksRead = MyAssignmentsRead & {
  /** The work state by assignment id; null when that read did not answer, so no state is shown. */
  states?: ReadonlyMap<string, WorkState> | null;
};

/**
 * The courses first: signed out or unavailable there is the page's state,
 * never an empty list. The states only add a line to a row, so a failed
 * states read (the route without a handler included) leaves the rows without
 * one: a state is never guessed.
 */
export async function readMyWorks(call: AssignmentsCall & WorkStatesCall): Promise<WorksRead> {
  const read = await readMyAssignments(call);
  if (read.kind !== "ready") return read;
  try {
    const result = await call("student.assignment-work.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) return { ...read, states: null };
    return { ...read, states: new Map(result.body.assignments.map((item) => [item.assignmentId, item.workState])) };
  } catch {
    return { ...read, states: null };
  }
}
