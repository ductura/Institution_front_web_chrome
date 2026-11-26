// NAS-R14: the read of the submissions already recorded for an assignment, for the warning on the extension form.
// It goes through the injected `call` (createApi in the host); no network primitive here.
import type { ExtensionSubmission } from "./model";

type SubmissionsAnswer =
  | { ok: true; status: 200; body: { assignments: readonly { assignmentId: string; submissions: readonly { studentId: string; submitted: boolean; requestedMinute: string | null }[] }[] } }
  | { ok: false; status: number; code: string };

export type SubmissionsCall = (
  id: "teacher.assignment-submissions.post",
  input: { params: undefined; query: undefined; body: { assignmentIds: string[] } },
) => Promise<SubmissionsAnswer>;

/** The submitted rows of this assignment; null when they cannot be read (never an empty list for a failure or another assignment's answer). */
export async function readExtensionSubmissions(call: SubmissionsCall, assignmentId: string): Promise<readonly ExtensionSubmission[] | null> {
  try {
    const result = await call("teacher.assignment-submissions.post", { params: undefined, query: undefined, body: { assignmentIds: [assignmentId] } });
    if (!result.ok) return null;
    const entry = result.body.assignments.find((a) => a.assignmentId === assignmentId.toLowerCase());
    if (entry === undefined) return null;
    return entry.submissions.flatMap((s) => (s.submitted && s.requestedMinute !== null ? [{ studentId: s.studentId, requestedMinute: s.requestedMinute }] : []));
  } catch {
    return null;
  }
}
