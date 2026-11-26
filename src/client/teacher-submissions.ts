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
 *
 * INT-12 (N05): both shapes are read from the contract itself (RESPONSES of
 * api.ts), no longer from local copies that had drifted (a documentId the
 * contract refuses, e.g. one with surrounding spaces, passed). Here only what
 * the contract cannot state is added: a real calendar minute, a student once.
 * contract-parsers.test.ts holds both reads to every 2xx vector.
 */

import { RESPONSES } from "./api";
import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export type SubmissionsRoute =
  | "teacher.submissions.get" | "teacher.submission-detail.get" | "teacher.receipt-pdf.get" | "teacher.work.get";

/** The transport; the page that mounts the screen binds it. */
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
/** The 200 schema the contract gives a route; a route without one reads as `nepoznato`. */
const contractSchema = (id: SubmissionsRoute): Schema =>
  RESPONSES.get(id)?.["200"]?.content?.["application/json"]?.schema ?? false;
const LIST = contractSchema("teacher.submissions.get");
const DETAIL = contractSchema("teacher.submission-detail.get");
// A real calendar minute, not only the contract's pattern: a row the table cannot format is `nepoznato`.
const MINUTE: Schema = { type: "string", format: "date-time" };

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
    if (submissions.some((s) => s.submitted && !matchesSchema(MINUTE, s.requestedMinute))) return UNKNOWN;
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

/** What "Preuzmi PDF potvrde" gets: the file to save, or why there is none (NAS-53, F4-NAS-R10). */
export type ReceiptPdfRead =
  | { readonly kind: "ok"; readonly blob: Blob; readonly filename: string }
  | { readonly kind: "session-expired" }
  | { readonly kind: "notFound" }
  | { readonly kind: "failed" };

const PDF = contractSchema("teacher.receipt-pdf.get");
const WORK = contractSchema("teacher.work.get");
const FAILED = { kind: "failed" } as const;

/** Standard Base64 into bytes; anything else (or a body that is not a PDF) is no file. */
function pdfBytes(base64: string): Uint8Array | null {
  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return raw.startsWith("%PDF-") ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * teacher.receipt-pdf.get: the PDF of the receipt of one student's submission. The server builds the file
 * (and its QR code); the browser only decodes it. Another teacher's or another student's work is the
 * server's 404 (`notFound`); every other refusal is one `failed`.
 */
export async function readTeacherReceiptPdf(call: SubmissionsCall, assignmentId: string, studentId: string): Promise<ReceiptPdfRead> {
  try {
    const result = await call("teacher.receipt-pdf.get", { params: { assignmentId, studentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : result.status === 404 ? { kind: "notFound" } : FAILED;
    if (result.status !== 200 || !matchesSchema(PDF, result.body)) return FAILED;
    const { filename, pdfBase64 } = result.body as { filename: string; pdfBase64: string };
    const bytes = pdfBytes(pdfBase64);
    return bytes === null ? FAILED : { kind: "ok", blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), filename };
  } catch {
    return FAILED;
  }
}

/**
 * The same, for the work the N-07 page shows: teacher.work.get names the assignment and the student, and a
 * work other than the one asked for is `failed`, never somebody else's file.
 */
export async function readTeacherWorkReceiptPdf(call: SubmissionsCall, documentId: string): Promise<ReceiptPdfRead> {
  try {
    const work = await call("teacher.work.get", { params: { documentId } });
    if (!work.ok) return work.status === 401 ? { kind: "session-expired" } : work.status === 404 ? { kind: "notFound" } : FAILED;
    if (work.status !== 200 || !matchesSchema(WORK, work.body)) return FAILED;
    const { documentId: got, assignmentId, studentId } = work.body as { documentId: string | null; assignmentId: string; studentId: string };
    return got === documentId ? await readTeacherReceiptPdf(call, assignmentId, studentId) : FAILED;
  } catch {
    return FAILED;
  }
}
