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
  | { kind: "denied" }
  | { kind: "unavailable" };

type Result<B> = { ok: true; status: 200; body: B } | { ok: false; status: number };
export type CoursesCall = {
  (id: "student.assignments.get", input: { params: undefined; query: undefined; body: undefined }): Promise<Result<{ courses: Course[] }>>;
  (id: "student.assignment-work.get", input: { params: undefined; query: undefined; body: undefined }):
    Promise<Result<{ assignments: { assignmentId: string; workState: WorkState }[] }>>;
  /** SRV#701: one list for all rows; an assignment not yet submitted has both fields null. */
  (id: "student.assignment-submissions.get", input: { params: undefined; query: undefined; body: undefined }):
    Promise<Result<{ assignments: { assignmentId: string; submittedAt: string | null; afterDeadline: boolean | null }[] }>>;
};

const NONE = { params: undefined, query: undefined, body: undefined } as const;

/** 401 is signed out and 403 denied (DIZ S-02, Z7/R8); anything else that fails is unavailable, never an empty list. States only when asked and proven; the submission times only when `withTimes` (a reader that shows none, as the portfolio, passes false). */
export async function readCourses(call: CoursesCall, withStates: boolean, withTimes = true): Promise<CoursesRead> {
  let courses: Course[];
  try {
    const r = await call("student.assignments.get", NONE);
    if (!r.ok) return r.status === 401 ? { kind: "signedOut" } : r.status === 403 ? { kind: "denied" } : { kind: "unavailable" };
    courses = r.body.courses;
  } catch {
    return { kind: "unavailable" };
  }
  if (!withStates) return { kind: "ready", courses, states: null };
  try {
    const r = await call("student.assignment-work.get", NONE);
    if (!r.ok) return { kind: "ready", courses, states: null };
    const states = new Map(r.body.assignments.map((a) => [a.assignmentId, a.workState]));
    // NF-1 P-6: one call to student.assignment-submissions.get for the whole list (never one per row).
    const submitted = withTimes ? await readSubmitted(call, states) : new Map<string, Submitted>();
    return { kind: "ready", courses, states, submitted };
  } catch {
    return { kind: "ready", courses, states: null };
  }
}

/** A time only for an assignment the work states prove submitted; a failed or unreadable answer leaves "Predano" alone. */
export async function readSubmitted(call: CoursesCall, states: ReadonlyMap<string, WorkState>): Promise<ReadonlyMap<string, Submitted>> {
  const submitted = new Map<string, Submitted>();
  try {
    const r = await call("student.assignment-submissions.get", NONE);
    if (!r.ok || !Array.isArray(r.body?.assignments)) return submitted;
    for (const a of r.body.assignments) {
      if (typeof a !== "object" || a === null || states.get(a.assignmentId) !== "submitted") continue;
      const s = submittedOf(a);
      if (s !== null) submitted.set(a.assignmentId, s);
    }
  } catch { /* no time, no guess */ }
  return submitted;
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

export type HomeExtras = { submitted: ReadonlyMap<string, Submitted>; extensions: ReadonlyMap<string, ExtensionNote> };

/**
 * E-2 (NF-1 P-6, P-7 on the home): the submission times for the whole list in one call (only when the work
 * states are proven) and the history of each extended deadline (one call per extended assignment, none for the
 * others). Either failing leaves its half empty; the row then says "Predano" or "Produljeni rok" alone.
 */
export async function readHomeExtras(
  call: CoursesCall, history: HistoryCall, courses: readonly Course[], states: ReadonlyMap<string, WorkState> | null | undefined,
): Promise<HomeExtras> {
  const [submitted, extensions] = await Promise.all([
    states ? readSubmitted(call, states) : Promise.resolve(new Map<string, Submitted>()),
    readExtensions(history, courses),
  ]);
  return { submitted, extensions };
}
