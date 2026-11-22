/**
 * A student's data export (WEB-1302, WEB-1302B; SRV-1308).
 *
 * The registry office requests it once it has checked the student's identity, the institution
 * administrator approves it with a reference, and the student downloads the file once, through a
 * link with a token, without a session. The three JSON routes go through createApi, which checks
 * every answer against the contract; the download is a file, so it goes through
 * studentDataDownloadCall in api.ts on the contract's path.
 */

import { createApi, studentDataDownloadCall, type ApiResult, type Input } from "./api";
import { matchesSchema } from "./schema-check";

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
type ExportOperation =
  | "institution.student-data-exports.get"
  | "institution.student-data-exports.post"
  | "institution.student-data-exports-approve.post";
/** The part of createApi the export page uses; a test hands in its own. */
export type StudentDataExportCall = <Id extends ExportOperation>(id: Id, input: Input<Id>) => Promise<ApiResult<Id>>;
export const studentDataExportCall = (): StudentDataExportCall => createApi();

const UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const UUID = { type: "string", pattern: UUID_PATTERN } as const;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const DOCUMENTS: readonly IdentityDocument[] = ["identity_card", "passport", "student_card"];
const NOTE = { type: "string", minLength: 1, maxLength: NOTE_MAX } as const;
const REFERENCE = { type: "string", minLength: 1, maxLength: REFERENCE_MAX } as const;

const failed = (status: number): { kind: FailedKind } =>
  ({ kind: status === 401 ? "signedOut" : status === 403 ? "denied" : "unavailable" });

/** institution.student-data-exports.get: the requests, newest first. Never throws. */
export async function listStudentDataExports(call: StudentDataExportCall = studentDataExportCall()): Promise<ListOutcome> {
  try {
    const result = await call("institution.student-data-exports.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) return failed(result.status);
    const { exports } = result.body;
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
    const result = await call("institution.student-data-exports.post", { params: undefined, query: undefined, body });
    if (result.ok) return { kind: "ok", exportId: result.body.exportId };
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
    const result = await call("institution.student-data-exports-approve.post", { params: { exportId }, query: undefined, body: { reference } });
    if (result.ok) return result.body.exportId === exportId ? { kind: "ok" } : { kind: "unavailable" };
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
