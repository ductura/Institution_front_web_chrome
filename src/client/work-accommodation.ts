/**
 * F4-PM2-R08 (M2.9, D-50): the approved accommodation mark of a work, read by the teacher.
 * teacher.student-accommodation.get answers `{ marked: boolean }` for one student of one assignment
 * (Institution_server#888). The teacher sees the mark only, never a reason.
 *
 * TODO(ugovor): the route is not in the WEB extract yet. Until it is, the shape is local (below) and the
 * caller passes the transport (`AccommodationCall`); on the extract the shape gives way to the contract's.
 */

import { matchesSchema, type Schema } from "./schema-check";

export type AccommodationCall = (
  id: "teacher.student-accommodation.get",
  input: { readonly params: { readonly assignmentId: string; readonly studentId: string } },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

const MARK: Schema = {
  type: "object",
  required: ["marked"],
  properties: { marked: { type: "boolean" } },
  additionalProperties: false,
};

/** One student's mark; null when the read fails or the answer is off the shape. */
export async function readStudentAccommodation(call: AccommodationCall, assignmentId: string, studentId: string): Promise<boolean | null> {
  const answer = await call("teacher.student-accommodation.get", { params: { assignmentId, studentId } }).catch(() => null);
  if (answer === null || !answer.ok || !matchesSchema(MARK, answer.body)) return null;
  return (answer.body as { marked: boolean }).marked;
}

/**
 * The marks of the students of one assignment, by student. One failed read makes the whole map null, so the
 * overview says "nedostupno" for the assignment rather than showing some students as unmarked.
 */
export async function readStudentAccommodations(
  call: AccommodationCall,
  assignmentId: string,
  studentIds: readonly string[],
): Promise<ReadonlyMap<string, boolean> | null> {
  const marks = await Promise.all(studentIds.map((id) => readStudentAccommodation(call, assignmentId, id)));
  if (marks.some((m) => m === null)) return null;
  return new Map(studentIds.map((id, i) => [id, marks[i] as boolean]));
}
