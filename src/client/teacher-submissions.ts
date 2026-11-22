/**
 * The teacher's submissions of one assignment and the submitted version read
 * only (WEB-1502; plan M7.2).
 *
 * - teacher.submissions.get: one `submissions` row per student; a submitted
 *   row names its revision, its minute and the server's `afterDeadline` flag.
 *   The flag is the server's; nothing here compares a time with a deadline.
 *   A row not submitted is not shown.
 * - teacher.submission-detail.get (by student): the immutable submitted
 *   document as JSON text. The server writes the opening to the access log, so it is read only
 *   when the teacher opens a row, never ahead.
 *
 * Every answer outside its closed shape, an unknown field included, is
 * `nepoznato`: an error, never shown.
 *
 * LOK-WEB-22: both shapes follow the published contract (API 1.84.0,
 * migration-contracts.generated.json). The earlier local draft had a
 * `submittedVersions` list and a `submissionId` the server never sends, so
 * no row was ever shown and no version could be opened. The caller still
 * passes the transport (`SubmissionsCall`).
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export type SubmissionsRoute = "teacher.submissions.get" | "teacher.submission-detail.get";

/** TODO(ugovor): the transport of a route that is not in the published contract yet. */
export type SubmissionsCall = (
  id: SubmissionsRoute,
  input: { readonly params: Readonly<Record<string, string>> },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type SubmittedRow = {
  readonly studentId: string;
  readonly revision: number;
  /** As recorded at submission; never computed here. */
  readonly late: boolean;
  /** `YYYY-MM-DDTHH:MM:00.000Z`, or null when the server names no time for this revision. */
  readonly requestedMinute: string | null;
};

export type SubmittedVersion = {
  readonly studentId: string;
  readonly revision: number;
  readonly late: boolean;
  /** The exact submitted JSON text. */
  readonly document: string;
};

export type SubmissionsRead = Read<{ kind: "ready"; rows: SubmittedRow[] }>;
export type VersionRead = Read<{ kind: "ready"; version: SubmittedVersion }>;

/** What the screen is given; the page that mounts it binds the transport. */
export interface TeacherSubmissionsPort {
  list(assignmentId: string): Promise<SubmissionsRead>;
  open(assignmentId: string, studentId: string): Promise<VersionRead>;
}

const UNKNOWN = { kind: "nepoznato" } as const;
const EXPIRED = { kind: "session-expired" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const REVISION = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
// A real calendar minute, not only its shape: a row the table cannot format is `nepoznato`.
const MINUTE = { type: "string", format: "date-time", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:00\\.000Z$" } as const;
const WORK_ID = { anyOf: [{ type: "null" }, { type: "string", minLength: 1 }] } as const;
const closed = (properties: Record<string, Schema>, optional: readonly string[] = []): Schema => ({
  type: "object", additionalProperties: false, properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
});

// TODO(ugovor): local copies of SRV-1508 (Institution_server #538) until the contract is published.
const NOT_SUBMITTED = closed({
  studentId: UUID, documentId: WORK_ID, submitted: { const: false },
  revision: { type: "null" }, requestedMinute: { type: "null" }, afterDeadline: { type: "null" },
});
const SUBMITTED = closed({
  studentId: UUID, documentId: WORK_ID, submitted: { const: true },
  revision: REVISION, requestedMinute: MINUTE, afterDeadline: { type: "boolean" },
});
const LIST = closed({ submissions: { type: "array", items: { anyOf: [NOT_SUBMITTED, SUBMITTED] } } });
const DETAIL = closed({ studentId: UUID, revision: REVISION, late: { type: "boolean" }, document: { type: "string" } });

type ListBody = {
  submissions: ({ studentId: string; submitted: false } | { studentId: string; submitted: true; revision: number; requestedMinute: string; afterDeadline: boolean })[];
};

async function read<T>(
  call: SubmissionsCall, id: SubmissionsRoute, params: Record<string, string>, schema: Schema, take: (body: unknown) => Read<T>,
): Promise<Read<T>> {
  try {
    const result = await call(id, { params });
    if (result.ok) return result.status === 200 && matchesSchema(schema, result.body) ? take(result.body) : UNKNOWN;
    if (result.status === 401) return EXPIRED;
    return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** teacher.submissions.get: one row per submitted student; a student twice is `nepoznato`. */
export function readTeacherSubmissions(call: SubmissionsCall, assignmentId: string): Promise<SubmissionsRead> {
  return read(call, "teacher.submissions.get", { assignmentId }, LIST, (body) => {
    const { submissions } = body as ListBody;
    const students = submissions.map((s) => s.studentId);
    if (new Set(students).size !== students.length) return UNKNOWN;
    const rows = submissions.flatMap((s): SubmittedRow[] => (s.submitted
      ? [{ studentId: s.studentId, revision: s.revision, late: s.afterDeadline, requestedMinute: s.requestedMinute }]
      : []));
    return { kind: "ready", rows };
  });
}

/** teacher.submission-detail.get: a version of another student than the one asked for is `nepoznato`. */
export function readSubmittedVersion(call: SubmissionsCall, assignmentId: string, studentId: string): Promise<VersionRead> {
  return read(call, "teacher.submission-detail.get", { assignmentId, studentId }, DETAIL, (body) => {
    const version = body as SubmittedVersion;
    return version.studentId === studentId ? { kind: "ready", version } : UNKNOWN;
  });
}

/** The port over a transport. */
export function submissionsPort(call: SubmissionsCall): TeacherSubmissionsPort {
  return {
    list: (assignmentId) => readTeacherSubmissions(call, assignmentId),
    open: (assignmentId, studentId) => readSubmittedVersion(call, assignmentId, studentId),
  };
}
