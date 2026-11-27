// WEB-NUZ-PREDAJA-2 (NF-3 PR-17, Daniel's answer 3, PO-37): whether the extended deadline of this work
// is the student's own exception, read through the shared client (student.deadline-history.get).
// Asked only when the assignment's deadline has passed and a later one holds; any failure is null,
// which leaves the ordinary "Rok produljen" and never holds the submission.
import { createApi } from "../../../../../../../src/client/api";
import { exceptionFrom, withLateRule, type Timing } from "./timing";

export type HistoryCall = (assignmentId: string) => Promise<{ readonly ok: boolean; readonly body?: unknown }>;

const serverHistory: HistoryCall = (assignmentId) =>
  createApi()("student.deadline-history.get", { params: { assignmentId }, query: undefined, body: undefined });

export async function readException(
  assignmentId: string, dueAt: string, extendedDueAt: string | null, now: number, call: HistoryCall = serverHistory,
): Promise<boolean | null> {
  const due = Date.parse(dueAt);
  const until = extendedDueAt === null ? Number.NaN : Date.parse(extendedDueAt);
  if (!Number.isFinite(due) || !Number.isFinite(until) || due >= now || until < now) return false;
  try {
    const answer = await call(assignmentId);
    return answer.ok ? exceptionFrom(answer.body, extendedDueAt, dueAt) : null;
  } catch {
    return null;
  }
}

/** F4-PRE-R01: the two reads behind a closed submission; each answers its body, or null when it failed. */
export type LateReads = {
  readonly rule: (assignmentId: string) => Promise<{ readonly ok: boolean; readonly body?: unknown }>;
  readonly exceptions: (assignmentId: string) => Promise<{ readonly ok: boolean; readonly body?: unknown }>;
};

const serverLate: LateReads = {
  rule: (assignmentId) => createApi()("student.assignment-late-submission.get", { params: { assignmentId }, query: undefined, body: undefined }),
  exceptions: (assignmentId) => createApi()("student.late-exceptions.get", { params: { assignmentId }, query: undefined, body: undefined }),
};

const bodyOf = async (read: Promise<{ readonly ok: boolean; readonly body?: unknown }>): Promise<unknown> => {
  try {
    const answer = await read;
    return answer.ok ? answer.body : null;
  } catch {
    return null;
  }
};

/**
 * F4-PRE-R01: after the deadline, whether the assignment takes a late submission and whether this student
 * holds an open exception, read only for a late timing. A failed read leaves the timing as it was.
 */
export async function withLateReads(timing: Timing, assignmentId: string, now: number, reads: LateReads = serverLate): Promise<Timing> {
  if (timing.kind !== "late") return timing;
  const [rule, exceptions] = await Promise.all([bodyOf(reads.rule(assignmentId)), bodyOf(reads.exceptions(assignmentId))]);
  const allowed = (rule as { lateSubmissionAllowed?: unknown } | null)?.lateSubmissionAllowed;
  return withLateRule(timing, typeof allowed === "boolean" ? allowed : null, exceptions, now);
}
