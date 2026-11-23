// PIL-D1-BEZ-OCJENE (P-D1): whether the assignment of a work is a practice one, for the calm note on N-07.
// teacher.work.get names the work's assignment; teacher.assignment-grade.get answers 409 practice_assignment for
// a practice one. Any other answer or a failure shows no note: the receipt itself is read and shown as before.
// No network primitive here: the page passes createApi's transport.
import { readGrade } from "../submissions/grade/contract";

export type PracticeCall = (
  id: "teacher.work.get" | "teacher.assignment-grade.get",
  input: { readonly params: Readonly<Record<string, string>>; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

const assignmentOf = (body: unknown, documentId: string): string | null => {
  if (typeof body !== "object" || body === null) return null;
  const work = body as { documentId?: unknown; assignmentId?: unknown };
  return work.documentId === documentId && typeof work.assignmentId === "string" && work.assignmentId.length > 0 ? work.assignmentId : null;
};

/** True only when the server says the work's assignment is a practice assignment. */
export async function readWorkPractice(call: PracticeCall, documentId: string): Promise<boolean> {
  try {
    const work = await call("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    const assignmentId = work.ok ? assignmentOf(work.body, documentId) : null;
    return assignmentId !== null && (await readGrade(call, assignmentId)).kind === "practice";
  } catch {
    return false;
  }
}
