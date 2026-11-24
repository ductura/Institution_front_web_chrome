// WEB-NUZ-PREDAJA-2 (NF-3 PR-17, Daniel's answer 3, PO-37): whether the extended deadline of this work
// is the student's own exception, read through the shared client (student.deadline-history.get).
// Asked only when the assignment's deadline has passed and a later one holds; any failure is null,
// which leaves the ordinary "Rok produljen" and never holds the submission.
import { createApi } from "../../../../../../../src/client/api";
import { exceptionFrom } from "./timing";

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
