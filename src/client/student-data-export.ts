/**
 * A student's data export (WEB-1302; SRV-1308).
 *
 * The registry office requests it once it has checked the student's identity, the institution
 * administrator approves it with a reference, and the student downloads the file once, through a
 * link with a token, without a session.
 *
 * TODO(ugovor): the four routes are not in the generated contracts yet, so the shapes are local
 * and checked here; the transports are studentDataExportCall and studentDataDownloadCall in api.ts
 * (the only file allowed an API URL), both injectable. When the contracts have the routes this
 * moves onto createApi and keeps its result types.
 */

import { studentDataDownloadCall, studentDataExportCall, type StudentDataExportCall } from "./api";
import { matchesSchema, type Schema } from "./schema-check";

export type IdentityDocument = "identity_card" | "passport" | "student_card";
export type ExportState = "requested" | "approved" | "ready" | "downloaded" | "expired";
export type StudentDataExport = {
  readonly exportId: string;
  readonly state: ExportState;
  readonly requestedAt: string;
  readonly expiresAt: string | null;
};

export type FailedKind = "signedOut" | "denied" | "unavailable";
export type ListOutcome = { readonly kind: "ok"; readonly exports: readonly StudentDataExport[] } | { readonly kind: FailedKind };
/** `notFound`: the person is not a student of the institution; `exists`: an open request is already there. */
export type RequestOutcome =
  | { readonly kind: "ok"; readonly exportId: string }
  | { readonly kind: FailedKind | "invalid" | "notFound" | "exists" };
/** `stale`: the request is no longer waiting (or is gone); the list is read again. */
export type ApproveOutcome = { readonly kind: "ok" } | { readonly kind: FailedKind | "invalid" | "stale" };
export type DownloadOutcome =
  | { readonly kind: "ready"; readonly bytes: ArrayBuffer; readonly filename: string; readonly type: string }
  /** 410: used, expired or unknown; the page never says which. */
  | { readonly kind: "gone" | "unavailable" };

export const NOTE_MAX = 80;
export const REFERENCE_MAX = 120;
export { studentDataExportCall };

const UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const UUID = { type: "string", pattern: UUID_PATTERN } as const;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const INSTANT = { type: "string", format: "date-time" } as const;
const STATES: readonly ExportState[] = ["requested", "approved", "ready", "downloaded", "expired"];
const DOCUMENTS: readonly IdentityDocument[] = ["identity_card", "passport", "student_card"];

// TODO(ugovor): local shapes of SRV-1308 (server/contracts/routes/student-data-export.ts).
const LIST: Schema = closed({
  exports: {
    type: "array",
    items: closed({
      exportId: UUID,
      state: { anyOf: STATES.map((c) => ({ const: c })) },
      requestedAt: INSTANT,
      expiresAt: { anyOf: [{ type: "null" }, INSTANT] },
    }),
  },
});
const CREATED: Schema = closed({ exportId: UUID });
const APPROVED: Schema = closed({ exportId: UUID, state: { const: "approved" } });
const NOTE = { type: "string", minLength: 1, maxLength: NOTE_MAX } as const;
const REFERENCE = { type: "string", minLength: 1, maxLength: REFERENCE_MAX } as const;

const failed = (status: number): { kind: FailedKind } =>
  ({ kind: status === 401 ? "signedOut" : status === 403 ? "denied" : "unavailable" });

/** institution.student-data-exports.get: the requests, newest first. Never throws. */
export async function listStudentDataExports(call: StudentDataExportCall = studentDataExportCall()): Promise<ListOutcome> {
  try {
    const result = await call("institution.student-data-exports.get", {});
    if (!result.ok) return failed(result.status);
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return { kind: "unavailable" };
    const { exports } = result.body as { exports: StudentDataExport[] };
    return new Set(exports.map((e) => e.exportId)).size === exports.length ? { kind: "ok", exports } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export type RequestInput = { readonly studentId: string; readonly identityCheckedBy: IdentityDocument; readonly note: string };

/** institution.student-data-exports.post: the registry office's request. Never throws. */
export async function requestStudentDataExport(
  input: RequestInput, call: StudentDataExportCall = studentDataExportCall(),
): Promise<RequestOutcome> {
  const body = { studentId: input.studentId, identityCheckedBy: input.identityCheckedBy, note: input.note };
  if (!matchesSchema(UUID, body.studentId) || !DOCUMENTS.includes(body.identityCheckedBy)
    || !matchesSchema(NOTE, body.note) || body.note.trim() !== body.note) return { kind: "invalid" };
  try {
    const result = await call("institution.student-data-exports.post", { body });
    if (result.ok) {
      return result.status === 201 && matchesSchema(CREATED, result.body)
        ? { kind: "ok", exportId: (result.body as { exportId: string }).exportId }
        : { kind: "unavailable" };
    }
    if (result.status === 404) return { kind: "notFound" };
    if (result.status === 409) return { kind: "exists" };
    if (result.status === 400 || result.status === 422) return { kind: "invalid" };
    return failed(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

/** institution.student-data-exports-approve.post: the administrator starts the export. Never throws. */
export async function approveStudentDataExport(
  exportId: string, reference: string, call: StudentDataExportCall = studentDataExportCall(),
): Promise<ApproveOutcome> {
  if (!matchesSchema(UUID, exportId)) return { kind: "stale" };
  if (!matchesSchema(REFERENCE, reference) || reference.trim() !== reference) return { kind: "invalid" };
  try {
    const result = await call("institution.student-data-exports-approve.post", { exportId, body: { reference } });
    if (result.ok) {
      const body = result.body as { exportId?: unknown };
      return result.status === 200 && matchesSchema(APPROVED, result.body) && body.exportId === exportId
        ? { kind: "ok" }
        : { kind: "unavailable" };
    }
    if (result.status === 404 || result.status === 409) return { kind: "stale" };
    if (result.status === 400 || result.status === 422) return { kind: "invalid" };
    return failed(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

export type DownloadOptions = {
  readonly baseUrl?: string;
  readonly transport?: Parameters<typeof studentDataDownloadCall>[0];
};

function filenameOf(header: string | null): string {
  const named = header === null ? null : /filename="?([A-Za-z0-9._-]{1,120})"?/.exec(header)?.[1];
  return named ?? "izvoz-mojih-podataka.zip";
}

/**
 * student.data-export.get: the one-time download. A token of the wrong shape is never sent and
 * reads as `gone`, like the server's 410; 200 with a non-empty body is `ready` with the bytes as
 * sent; anything else, an empty body or a broken connection is `unavailable`. Never throws.
 */
export async function downloadStudentDataExport(token: string, options: DownloadOptions = {}): Promise<DownloadOutcome> {
  if (!TOKEN.test(token)) return { kind: "gone" };
  try {
    const response = await studentDataDownloadCall(options.transport, options.baseUrl)(token);
    if (response.status === 410) return { kind: "gone" };
    if (response.status !== 200) return { kind: "unavailable" };
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) return { kind: "unavailable" };
    return {
      kind: "ready",
      bytes,
      filename: filenameOf(response.headers.get("content-disposition")),
      type: response.headers.get("content-type") ?? "application/zip",
    };
  } catch {
    return { kind: "unavailable" };
  }
}
