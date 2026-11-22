// WEB-2103: one read of student.assignments.get (and, for E-4, the work states) with
// the A-3 fields (groups, workType, mentor) the shared MyCourse type does not carry.
import type { Group, Mentor } from "./model";

export type Assignment = {
  id: string; title: string; dueAt: string; noticeFirst: boolean;
  workType?: string; mentor?: Mentor | null; extendedDueAt?: string | null;
};
export type Course = { id: string; name: string; academicYear?: string; groups?: Group[]; assignments: Assignment[] };
export type WorkState = "not_started" | "in_progress" | "submitted";

export type CoursesRead =
  | { kind: "ready"; courses: Course[]; states: ReadonlyMap<string, WorkState> | null }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

type Result<B> = { ok: true; status: 200; body: B } | { ok: false; status: number };
export type CoursesCall = {
  (id: "student.assignments.get", input: { params: undefined; query: undefined; body: undefined }): Promise<Result<{ courses: Course[] }>>;
  (id: "student.assignment-work.get", input: { params: undefined; query: undefined; body: undefined }):
    Promise<Result<{ assignments: { assignmentId: string; workState: WorkState }[] }>>;
};

const NONE = { params: undefined, query: undefined, body: undefined } as const;

/** 401 is signed out; anything else that fails is unavailable, never an empty list. States only when asked and proven. */
export async function readCourses(call: CoursesCall, withStates: boolean): Promise<CoursesRead> {
  let courses: Course[];
  try {
    const r = await call("student.assignments.get", NONE);
    if (!r.ok) return r.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
    courses = r.body.courses;
  } catch {
    return { kind: "unavailable" };
  }
  if (!withStates) return { kind: "ready", courses, states: null };
  try {
    const r = await call("student.assignment-work.get", NONE);
    if (!r.ok) return { kind: "ready", courses, states: null };
    return { kind: "ready", courses, states: new Map(r.body.assignments.map((a) => [a.assignmentId, a.workState])) };
  } catch {
    return { kind: "ready", courses, states: null };
  }
}
