// WEB-1801 (M8.2, M8.2b): the student bringing in an existing DOCX or PDF.
// The intake contract (M8.0-S1, `import_event`, manifest with three hashes) is
// not in the generated contracts yet, so this client takes its transport as a
// parameter: the file goes to the server, the server answers a preview, and
// the text enters the work only after the student confirms it. Nothing here
// reads the file's text in the browser and nothing makes a request by itself
// (no-direct-api); the default transport reports "unavailable" until the
// generated client carries the routes. Answers are checked strictly: an
// unknown shape is "unavailable", never a partial preview.

export type ImportFormat = "docx" | "pdf";
/** The ceiling of one uploaded file; the server's own limit (D-291) may be lower. */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_PARAGRAPHS = 5_000;

export type ImportPreview = {
  previewId: string;
  format: ImportFormat;
  paragraphs: string[];
  words: number;
};
export type ImportRefusalReason = "type" | "tooLarge" | "empty" | "unreadable";

export type ImportConfirmed = { importedAt: string; words: number; source: "file_import" };

export type ImportRaw = { ok: boolean; status: number; body?: unknown };
/** The three calls of the intake contract, as the host wires them. */
export type ImportTransport = {
  permission(assignmentId: string): Promise<ImportRaw>;
  preview(assignmentId: string, file: File): Promise<ImportRaw>;
  confirm(assignmentId: string, previewId: string): Promise<ImportRaw>;
};

export const unavailableTransport: ImportTransport = {
  permission: async () => ({ ok: false, status: 0 }),
  preview: async () => ({ ok: false, status: 0 }),
  confirm: async () => ({ ok: false, status: 0 }),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function importFormatOf(file: { name: string }): ImportFormat | null {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return extension === "docx" || extension === "pdf" ? extension : null;
}

export type ImportPermission = { kind: "allowed" | "notAllowed" | "signedOut" | "unavailable" };

/** Without a clear "allowed" the student sees no intake button (M8.2b). */
export async function readImportPermission(
  assignmentId: string, transport: ImportTransport = unavailableTransport,
): Promise<ImportPermission> {
  if (!UUID.test(assignmentId)) return { kind: "notAllowed" };
  try {
    const result = await transport.permission(assignmentId);
    if (result.status === 401) return { kind: "signedOut" };
    if (!result.ok || !record(result.body) || typeof result.body.importAllowed !== "boolean") return { kind: "unavailable" };
    return { kind: result.body.importAllowed ? "allowed" : "notAllowed" };
  } catch {
    return { kind: "unavailable" };
  }
}

export type PreviewResult =
  | { kind: "preview"; preview: ImportPreview }
  | { kind: "refused"; reason: ImportRefusalReason }
  | { kind: "notAllowed" | "signedOut" | "unavailable" };

export async function previewImport(
  assignmentId: string, file: File, transport: ImportTransport = unavailableTransport,
): Promise<PreviewResult> {
  const format = importFormatOf(file);
  if (!UUID.test(assignmentId)) return { kind: "unavailable" };
  if (!format) return { kind: "refused", reason: "type" };
  if (file.size === 0) return { kind: "refused", reason: "empty" };
  if (file.size > IMPORT_MAX_BYTES) return { kind: "refused", reason: "tooLarge" };
  try {
    const result = await transport.preview(assignmentId, file);
    if (result.status === 401) return { kind: "signedOut" };
    if (result.status === 403) return { kind: "notAllowed" };
    if (result.status === 413) return { kind: "refused", reason: "tooLarge" };
    if (result.status === 415) return { kind: "refused", reason: "type" };
    if (result.status === 422) return { kind: "refused", reason: "unreadable" };
    const body = result.body;
    if (!result.ok || !record(body) || typeof body.previewId !== "string" || !UUID.test(body.previewId) ||
        body.format !== format || !count(body.words) || !Array.isArray(body.paragraphs) ||
        body.paragraphs.length > MAX_PARAGRAPHS || !body.paragraphs.every((p) => typeof p === "string")) {
      return { kind: "unavailable" };
    }
    if (body.paragraphs.length === 0) return { kind: "refused", reason: "empty" };
    return { kind: "preview", preview: { previewId: body.previewId, format, paragraphs: body.paragraphs as string[], words: body.words } };
  } catch {
    return { kind: "unavailable" };
  }
}

export type ConfirmResult =
  | { kind: "confirmed"; confirmed: ImportConfirmed }
  | { kind: "notAllowed" | "signedOut" | "expired" | "unavailable" };

/** Idempotent on the server: confirming the same preview again returns the same event. */
export async function confirmImport(
  assignmentId: string, previewId: string, declared: boolean, transport: ImportTransport = unavailableTransport,
): Promise<ConfirmResult> {
  if (!declared || !UUID.test(assignmentId) || !UUID.test(previewId)) return { kind: "unavailable" };
  try {
    const result = await transport.confirm(assignmentId, previewId);
    if (result.status === 401) return { kind: "signedOut" };
    if (result.status === 403) return { kind: "notAllowed" };
    if (result.status === 404 || result.status === 410) return { kind: "expired" };
    const body = result.body;
    if (!result.ok || !record(body) || body.source !== "file_import" || !count(body.words) ||
        typeof body.importedAt !== "string" || new Date(Date.parse(body.importedAt)).toISOString() !== body.importedAt) {
      return { kind: "unavailable" };
    }
    return { kind: "confirmed", confirmed: { importedAt: body.importedAt, words: body.words, source: "file_import" } };
  } catch {
    return { kind: "unavailable" };
  }
}
