// WEB-2103: one read of student.assignments.get (and, for E-4, the work states) with
// the A-3 fields (groups, workType, mentor) the shared MyCourse type does not carry.
import { createApi } from "../../../../../../src/client/api";
import type { MyAssignment } from "../read/assignments";
import { extensionOf, submittedOf, type ExtensionNote, type Group, type Mentor, type Submitted } from "./model";

export type Assignment = {
  id: string; title: string; dueAt: string; noticeFirst: boolean;
  // The contract's closed set of work kinds, as the shared MyAssignment carries it since WEB-2102.
  workType?: MyAssignment["workType"]; mentor?: Mentor | null; extendedDueAt?: string | null;
  /** P-D1: the server's practice flag; absent is not practice (the badge is never guessed). */
  isPractice?: boolean;
};
export type Course = { id: string; name: string; academicYear?: string; groups?: Group[]; assignments: Assignment[] };
export type WorkState = "not_started" | "in_progress" | "submitted";

export type CoursesRead =
  | { kind: "ready"; courses: Course[]; states: ReadonlyMap<string, WorkState> | null; submitted?: ReadonlyMap<string, Submitted> }
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
    // NF-1 P-6: a time only where the answer carries a valid one (the contract has none yet).
    const submitted = new Map<string, Submitted>();
    for (const a of r.body.assignments) {
      const s = a.workState === "submitted" ? submittedOf(a) : null;
      if (s !== null) submitted.set(a.assignmentId, s);
    }
    return { kind: "ready", courses, states: new Map(r.body.assignments.map((a) => [a.assignmentId, a.workState])), submitted };
  } catch {
    return { kind: "ready", courses, states: null };
  }
}

export type HistoryCall = (assignmentId: string) => Promise<{ readonly ok: boolean; readonly body?: unknown }>;

/**
 * NF-1 P-7: the history of each extended deadline, from student.deadline-history.get. Asked only for an
 * assignment that has `extendedDueAt` (not one call per row), and a failed or unreadable answer leaves that
 * assignment out: its row then says "Produljeni rok" without a history.
 */
export async function readExtensions(call: HistoryCall, courses: readonly Course[]): Promise<ReadonlyMap<string, ExtensionNote>> {
  const extended = courses.flatMap((c) => c.assignments).filter((a) => typeof a.extendedDueAt === "string" && a.extendedDueAt !== "");
  const notes = new Map<string, ExtensionNote>();
  await Promise.all(extended.map(async (a) => {
    try {
      const r = await call(a.id);
      const note = r.ok ? extensionOf(r.body, a.extendedDueAt as string) : null;
      if (note !== null) notes.set(a.id, note);
    } catch { /* the row keeps "Produljeni rok" alone */ }
  }));
  return notes;
}

export const serverHistory: HistoryCall = (assignmentId) =>
  createApi()("student.deadline-history.get", { params: { assignmentId }, query: undefined, body: undefined });
