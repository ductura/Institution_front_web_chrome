/**
 * The teacher's reads of wave 5 (WEB-30; N-04, N-07, N-17; §5 rules 5 and 17).
 *
 * - teacher.course-students.get: the students of a course with their group
 *   and the state of their work per assignment. A name the server does not
 *   have is `null`, never a stand-in.
 * - teacher.assignment-overview.get: one row per student; no text, no hash
 *   and no submission id.
 * - teacher.submission-receipt.get: the same body as student.submission.get,
 *   read by the same function (`readSubmissionState`, WEB-22), so the teacher
 *   sees exactly the receipt the student sees and it passes the same
 *   schema-check (rule 5). The server writes the access log (rule 17).
 *
 * Every answer outside its closed shape, an unknown field included, is
 * `nepoznato`: an error, never shown. Another teacher's, an unknown and a
 * malformed id read as an empty list (SRV-29) or 404 (SRV-30).
 *
 * TODO(ugovor): these routes come with @ductura/contracts 3.2.0 (SRV-27,
 * SRV-32). Until then the shapes are local (below), the caller passes the
 * transport (`TeacherCall`) and only tests call them, with invented answers.
 * On 3.2.0 they move to createApi and these schemas give way to the contract's.
 */

import { matchesSchema, type Schema } from "./schema-check";
import { readSubmissionState, type LocalCall, type Read, type SubmissionRead } from "./submission";

export type TeacherRoute = "teacher.course-students.get" | "teacher.assignment-overview.get" | "teacher.submission-receipt.get";

/** TODO(ugovor): the transport of a route that is not in the published contract yet. */
export type TeacherCall = (
  id: TeacherRoute,
  input: { readonly params: Readonly<Record<string, string>> },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type WorkState = "predano" | "nije_predano" | "nakon_roka" | "ceka";
export type EvidenceRecord = "continuous" | "with_gaps";

export type CourseStudent = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly works: readonly { readonly assignmentId: string; readonly state: WorkState }[];
};

export type OverviewRow = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly submitted: boolean;
  /** UTC minute, `YYYY-MM-DDTHH:MMZ`; null until submitted. */
  readonly requestedMinute: string | null;
  readonly afterDeadline: boolean;
  /** From the receipt; null while the receipt is not bound (`ceka`) or nothing is submitted. */
  readonly evidenceRecord: EvidenceRecord | null;
  /** TODO(ugovor): optional until SRV-27 (3.2.0) makes it part of the contract; links the row to N-07. */
  readonly documentId?: string;
};

const UNKNOWN = { kind: "nepoznato" } as const;
const EXPIRED = { kind: "session-expired" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const TEXT = { type: "string", minLength: 1, maxLength: 256 } as const;
const OR_NULL = (schema: Schema): Schema => ({ anyOf: [{ type: "null" }, schema] });
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const list = (key: string, item: Schema): Schema => closed({ [key]: { type: "array", items: item } });

// TODO(ugovor): local shapes until 3.2.0 (SRV-27).
const STUDENTS = list("students", closed({
  studentId: UUID,
  name: OR_NULL(TEXT),
  group: OR_NULL(TEXT),
  works: { type: "array", items: closed({ assignmentId: UUID, state: { anyOf: ["predano", "nije_predano", "nakon_roka", "ceka"].map((c) => ({ const: c })) } }) },
}));
/** The server's minute (`YYYY-MM-DDTHH:MM:00.000Z`, LOK-WEB-2); the row keeps `YYYY-MM-DDTHH:MMZ`. */
const WIRE_MINUTE = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:00\\.000Z$" } as const;
const NAME = { type: "string", minLength: 1, maxLength: 255 } as const;
/** teacher.assignment-overview.get as the contract gives it (LOK-WEB-2). */
const OVERVIEW = list("students", closed({
  studentId: UUID,
  givenName: OR_NULL(NAME),
  familyName: OR_NULL(NAME),
  groupName: OR_NULL({ type: "string", minLength: 1 }),
  submitted: { type: "boolean" },
  requestedMinute: OR_NULL(WIRE_MINUTE),
  afterDeadline: OR_NULL({ type: "boolean" }),
  evidenceRecord: { anyOf: [{ type: "null" }, { const: "continuous" }, { const: "with_gaps" }] },
}));

type OverviewWire = {
  studentId: string; givenName: string | null; familyName: string | null; groupName: string | null;
  submitted: boolean; requestedMinute: string | null; afterDeadline: boolean | null; evidenceRecord: EvidenceRecord | null;
};

/** The contract row as the page's row; a half name, or a deadline flag that disagrees with `submitted`, is null (contradiction). */
function toRow(w: OverviewWire): OverviewRow | null {
  if ((w.givenName === null) !== (w.familyName === null)) return null;
  if (w.submitted !== (w.afterDeadline !== null)) return null;
  return {
    studentId: w.studentId,
    name: w.givenName === null ? null : `${w.givenName} ${w.familyName}`,
    group: w.groupName,
    submitted: w.submitted,
    requestedMinute: w.requestedMinute === null ? null : `${w.requestedMinute.slice(0, 16)}Z`,
    afterDeadline: w.afterDeadline ?? false,
    evidenceRecord: w.evidenceRecord,
  };
}

/** A row is consistent: a time and a record only when submitted, after the deadline only when submitted. */
function consistent(row: OverviewRow): boolean {
  if (!row.submitted) return row.requestedMinute === null && row.evidenceRecord === null && !row.afterDeadline;
  return row.requestedMinute !== null && realMinute(row.requestedMinute);
}

const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

/** A real UTC minute: the calendar date exists and the hour and minute are in range. */
function realMinute(minute: string): boolean {
  const [date, time] = minute.slice(0, -1).split("T") as [string, string];
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() && h <= 23 && min <= 59;
}

async function read<T>(
  call: TeacherCall, id: TeacherRoute, params: Record<string, string>, schema: Schema, take: (body: unknown) => Read<T>,
): Promise<Read<T>> {
  try {
    const result = await call(id, { params });
    if (result.ok) return result.status === 200 && matchesSchema(schema, result.body) ? take(result.body) : UNKNOWN;
    return result.status === 401 ? EXPIRED : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** teacher.course-students.get (TODO(ugovor), N-04): a student or an assignment of one student twice is `nepoznato`. */
export function readCourseStudents(call: TeacherCall, courseId: string): Promise<Read<{ kind: "ready"; students: CourseStudent[] }>> {
  return read(call, "teacher.course-students.get", { courseId }, STUDENTS, (body) => {
    const { students } = body as { students: CourseStudent[] };
    const once = unique(students.map((s) => s.studentId)) && students.every((s) => unique(s.works.map((w) => w.assignmentId)));
    return once ? { kind: "ready", students } : UNKNOWN;
  });
}

/** teacher.assignment-overview.get (TODO(ugovor), N-17): a contradictory row makes the whole read `nepoznato`. */
export function readAssignmentOverview(call: TeacherCall, assignmentId: string): Promise<Read<{ kind: "ready"; rows: OverviewRow[] }>> {
  return read(call, "teacher.assignment-overview.get", { assignmentId }, OVERVIEW, (body) => {
    const mapped = (body as { students: OverviewWire[] }).students.map(toRow);
    if (mapped.some((r) => r === null)) return UNKNOWN;
    const rows = mapped as OverviewRow[];
    return rows.every(consistent) && unique(rows.map((r) => r.studentId)) ? { kind: "ready", rows } : UNKNOWN;
  });
}

/**
 * teacher.submission-receipt.get (TODO(ugovor), N-07): the student's read
 * itself over the teacher's route, so the shape, the receipt check and the
 * outcomes are the student's. A receipt for another assignment is `nepoznato`.
 */
export function readTeacherReceipt(call: TeacherCall, assignmentId: string, studentId: string): Promise<SubmissionRead> {
  const local: LocalCall = (id) =>
    id === "student.submission.get"
      ? call("teacher.submission-receipt.get", { params: { assignmentId, studentId } })
      : Promise.reject(new Error(`teacher-reads: ${id} is not a teacher read`));
  return readSubmissionState(local, assignmentId);
}
