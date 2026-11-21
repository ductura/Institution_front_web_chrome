/**
 * The teacher's submissions of one assignment and the submitted version read
 * only (WEB-1502; plan M7.2).
 *
 * - teacher.submissions.get: `submittedVersions` names each recorded
 *   submission with its pinned `late` flag. The flag is the server's; nothing
 *   here compares a time with a deadline. The time shown is the
 *   `requestedMinute` of the `submissions` row of the same student and
 *   revision, or none.
 * - teacher.submission-detail.get: the immutable submitted document as JSON
 *   text. The server writes the opening to the access log, so it is read only
 *   when the teacher opens a row, never ahead.
 *
 * Every answer outside its closed shape, an unknown field included, is
 * `nepoznato`: an error, never shown.
 *
 * TODO(ugovor): both shapes come from Institution_server PR #538 (SRV-1508),
 * not in @ductura/contracts yet. Until then they are local (below), the caller
 * passes the transport (`SubmissionsCall`) and only tests call them, with
 * invented answers. When the contract is published they move to createApi.
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
  /** Null until the receipt is bound: the version cannot be opened yet. */
  readonly submissionId: string | null;
};

export type SubmittedVersion = {
  readonly studentId: string;
  readonly submissionId: string;
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
  open(assignmentId: string, submissionId: string): Promise<VersionRead>;
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
const VERSION = closed({ studentId: UUID, revision: REVISION, late: { type: "boolean" }, submissionId: { anyOf: [UUID, { type: "null" }] } });
const LIST = closed({
  submissions: { type: "array", items: { anyOf: [NOT_SUBMITTED, SUBMITTED] } },
  submittedVersions: { type: "array", items: VERSION },
}, ["submittedVersions"]);
const DETAIL = closed({ studentId: UUID, submissionId: UUID, revision: REVISION, late: { type: "boolean" }, document: { type: "string" } });

type ListBody = {
  submissions: { studentId: string; revision: number | null; requestedMinute: string | null }[];
  submittedVersions?: Omit<SubmittedRow, "requestedMinute">[];
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

/**
 * teacher.submissions.get (TODO(ugovor)): one row per recorded submission.
 * The server leaves `submittedVersions` out when no version is recorded
 * (SRV-1508 teacher-reads), so its absence is an empty table. A student
 * twice, or two versions with one submission id, is `nepoznato`.
 */
export function readTeacherSubmissions(call: SubmissionsCall, assignmentId: string): Promise<SubmissionsRead> {
  return read(call, "teacher.submissions.get", { assignmentId }, LIST, (body) => {
    const { submissions, submittedVersions = [] } = body as ListBody;
    const ids = submittedVersions.flatMap((v) => (v.submissionId === null ? [] : [v.submissionId]));
    const students = submittedVersions.map((v) => v.studentId);
    if (new Set(students).size !== students.length || new Set(ids).size !== ids.length) return UNKNOWN;
    const rows = submittedVersions.map((v): SubmittedRow => ({
      studentId: v.studentId, revision: v.revision, late: v.late, submissionId: v.submissionId,
      requestedMinute: submissions.find((s) => s.studentId === v.studentId && s.revision === v.revision)?.requestedMinute ?? null,
    }));
    return { kind: "ready", rows };
  });
}

/** teacher.submission-detail.get (TODO(ugovor)): a version of another submission than the one asked for is `nepoznato`. */
export function readSubmittedVersion(call: SubmissionsCall, assignmentId: string, submissionId: string): Promise<VersionRead> {
  return read(call, "teacher.submission-detail.get", { assignmentId, submissionId }, DETAIL, (body) => {
    const version = body as SubmittedVersion;
    return version.submissionId === submissionId ? { kind: "ready", version } : UNKNOWN;
  });
}

/** The port over a transport. */
export function submissionsPort(call: SubmissionsCall): TeacherSubmissionsPort {
  return {
    list: (assignmentId) => readTeacherSubmissions(call, assignmentId),
    open: (assignmentId, submissionId) => readSubmittedVersion(call, assignmentId, submissionId),
  };
}
