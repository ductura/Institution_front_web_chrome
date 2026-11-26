// WEB-V14-SHEET-EXPORT: the two spreadsheet downloads, work.export-sheet-csv.get and work.export-sheet-xlsx.get.
// The generated client keeps no body for a file answer, so each is one GET through the transport it is given
// (the shared browser transport in the page, a recorded one in tests). Nothing is called a file unless the answer
// is a 200 of the contract's media type whose bytes look like that file (a ZIP for .xlsx, a UTF-8 text for CSV) and,
// when the server named a SHA-256 for the bytes, whose digest is that one. Anything else is a failure, never a file.
import { SERVER_PREFIX, type browserTransport } from "../../../../../../src/client/api";

/** The shared browser transport, or a recorded one in tests. */
export type Transport = typeof browserTransport;

export type ExportKind = "csv" | "xlsx";

export type ExportResult =
  | { readonly kind: "ready"; readonly bytes: Uint8Array<ArrayBuffer>; readonly mime: string; readonly sha256: string | null }
  | { readonly kind: "signed-out" }
  | { readonly kind: "not-found" }
  | { readonly kind: "invalid" }
  | { readonly kind: "mismatch" }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "unavailable" };

export const CSV_MIME = "text/csv";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The paths of the two operations, as the contract names them. */
export const exportPath = (kind: ExportKind, documentId: string): string =>
  `${SERVER_PREFIX}works/${encodeURIComponent(documentId)}/export/${kind}`;

const SHA256 = /^[0-9a-f]{64}$/;
const ZIP_MAGIC = [0x50, 0x4b];

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function failure(status: number): ExportResult {
  if (status === 401) return { kind: "signed-out" };
  if (status === 404) return { kind: "not-found" };
  if (status === 422) return { kind: "invalid" };
  return { kind: "unavailable" };
}

/** Reads one export of one work. The sheet and version are left to the server: the first sheet, the saved version. */
export async function readExport(
  transport: Transport, kind: ExportKind, documentId: string, signal?: AbortSignal,
): Promise<ExportResult> {
  let response: Response;
  try {
    response = await transport(new URL(exportPath(kind, documentId), globalThis.location.origin), {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (response.status !== 200) return failure(response.status);
  const mime = kind === "csv" ? CSV_MIME : XLSX_MIME;
  if (!(response.headers.get("content-type") ?? "").toLowerCase().startsWith(mime)) return { kind: "not-a-file" };
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { kind: "unavailable" };
  }
  if (bytes.byteLength === 0) return { kind: "not-a-file" };
  if (kind === "xlsx" && !ZIP_MAGIC.every((b, i) => bytes[i] === b)) return { kind: "not-a-file" };
  const named = kind === "xlsx" ? response.headers.get("x-export-sheet-sha256") : null;
  const digest = await sha256Hex(bytes);
  if (named !== null) {
    if (!SHA256.test(named) || named !== digest) return { kind: "mismatch" };
  }
  return { kind: "ready", bytes, mime, sha256: named === null ? null : digest };
}

/** The download name: the title of the work with what a file name cannot hold replaced, then the extension. */
export function exportFileName(title: string | null, kind: ExportKind): string {
  const name = (title ?? "").trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/[. ]+$/u, "");
  return `${name || "tablica"}.${kind}`;
}
