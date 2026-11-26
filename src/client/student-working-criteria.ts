/**
 * The working criteria of the student's own work, each teacher's separately (ED-35).
 *
 * Daniel's decision of 26. 11. 2026 (Ductus#2058, replacing B-9): the student
 * who owns the work sees the working criteria. student.working-criteria.get
 * (Institution_server#838) answers 200 {teachers}: one entry per teacher who
 * set at least one criterion, never merged, ordered by the server. Each entry
 * has the teacher's id, the name pair or null when the institution holds none,
 * and the same six criteria in the same shape as teacher.working-criteria.get.
 * An empty list means no teacher has set one yet. A teacher, another student,
 * an unknown work and a malformed id all read the same 404. The student only
 * reads: there is no write here. The caller passes the transport.
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";
import { CRITERIA_COUNT, CRITERION, WORK_ID, type WorkingCriterion } from "./teacher-working-criteria";

export type TeacherName = { readonly givenName: string; readonly familyName: string };

export type TeacherCriteria = {
  readonly teacherId: string;
  /** Null when the institution holds no name for the teacher. */
  readonly teacherName: TeacherName | null;
  readonly criteria: readonly WorkingCriterion[];
};

export type StudentCriteriaCall = (
  id: "student.working-criteria.get",
  input: { readonly params: { readonly documentId: string }; readonly query: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type StudentCriteriaRead = Read<{ readonly kind: "ready"; readonly teachers: readonly TeacherCriteria[] }>;

const UNKNOWN = { kind: "nepoznato" } as const;
const CODE_POINT = "[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]";
const UUID: Schema = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
// A name of the login claims: 1 to 255 code points.
const NAME: Schema = { type: "string", pattern: `^(?:${CODE_POINT}|[^\\uD800-\\uDFFF]){1,255}(?![\\s\\S])` };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const TEACHER: Schema = closed({
  teacherId: UUID,
  teacherName: { anyOf: [{ type: "null" }, closed({ givenName: NAME, familyName: NAME })] },
  criteria: { type: "array", minItems: CRITERIA_COUNT, maxItems: CRITERIA_COUNT, items: CRITERION },
});
const LIST: Schema = closed({ teachers: { type: "array", items: TEACHER } });

const distinct = (values: readonly string[]): boolean => new Set(values).size === values.length;

/** student.working-criteria.get. Six distinct criteria per teacher, each teacher once, else unknown. Never throws. */
export async function readStudentCriteria(call: StudentCriteriaCall, documentId: string): Promise<StudentCriteriaRead> {
  if (!matchesSchema(WORK_ID, documentId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("student.working-criteria.get", { params: { documentId }, query: undefined });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { teachers } = result.body as { teachers: TeacherCriteria[] };
    const sound = distinct(teachers.map((x) => x.teacherId)) && teachers.every((x) => distinct(x.criteria.map((c) => c.id)));
    return sound ? { kind: "ready", teachers } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** The teacher's name as the student reads it; null when the server holds none. */
export const teacherNameText = (name: TeacherName | null): string | null =>
  name === null ? null : `${name.givenName} ${name.familyName}`;
