/**
 * The teacher's read of the submissions of one assignment (WEB-1502; plan M7.2).
 *
 * teacher.submissions.get gives one row per student with a work: the work's
 * document, whether it is submitted, the revision, the UTC minute of the
 * request and `afterDeadline`, which the SERVER decides from the deadline. The
 * browser never computes lateness (§5), so the screen's "Poslije roka" tag is
 * that field and nothing else.
 *
 * The answer is the contract's own (createApi already checked it against the
 * schema); here it is only narrowed once more: a student twice, a submitted row
 * without a revision or with an impossible minute makes the whole read
 * `unavailable`, never a table that may be wrong. Another teacher's, an unknown
 * and a malformed assignment id read as an empty list (the server's rule).
 */

import type { ApiResult } from "./api";

type Answer = Extract<ApiResult<"teacher.submissions.get">, { ok: true }>["body"];
export type SubmissionRow = Answer["submissions"][number];

/** What the screen needs of createApi(): teacher.submissions.get only. */
export type SubmissionsCall = (
  id: "teacher.submissions.get",
  input: { params: { assignmentId: string }; query: undefined; body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type SubmissionsRead =
  | { kind: "ready"; rows: readonly SubmissionRow[] }
  | { kind: "signedOut" }
  | { kind: "notTeacher" }
  | { kind: "unavailable" };

const UNAVAILABLE = { kind: "unavailable" } as const;

/** A real UTC minute `YYYY-MM-DDTHH:MMZ`. */
function realMinute(minute: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/.exec(minute);
  if (match === null) return false;
  const [y, m, d, h, min] = match.slice(1).map(Number) as [number, number, number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() && h <= 23 && min <= 59;
}

function consistent(row: SubmissionRow): boolean {
  if (!row.submitted) return row.revision === null && row.requestedMinute === null && row.afterDeadline === null;
  return Number.isInteger(row.revision) && row.revision >= 1
    && typeof row.afterDeadline === "boolean" && realMinute(row.requestedMinute);
}

export async function readAssignmentSubmissions(call: SubmissionsCall, assignmentId: string): Promise<SubmissionsRead> {
  try {
    const result = await call("teacher.submissions.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : result.status === 403 ? { kind: "notTeacher" } : UNAVAILABLE;
    const rows = (result.body as Partial<Answer> | null)?.submissions;
    if (result.status !== 200 || !Array.isArray(rows)) return UNAVAILABLE;
    const once = new Set(rows.map((r) => r.studentId)).size === rows.length;
    return once && rows.every(consistent) ? { kind: "ready", rows } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
