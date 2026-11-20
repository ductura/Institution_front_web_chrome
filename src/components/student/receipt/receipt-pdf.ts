/**
 * The PDF record of a signed receipt (S: PO-21; student.receipt-pdf.get,
 * GET /api/v1/student/assignments/{assignmentId}/submission/pdf). The server
 * builds the file and its QR code; the browser only fetches and saves it.
 *
 * TODO(ugovor): the route is not in the generated contract of this base yet,
 * so the request is written here with the same transport as createApi and
 * moves there when the contract carries it. Every answer maps onto one
 * closed table; a 404 is a message, never an empty page.
 */

import { browserTransport } from "../../../client/api";

export type ReceiptPdfOutcome =
  | { readonly kind: "ok"; readonly blob: Blob }
  | { readonly kind: "notFound" | "signedOut" | "unavailable" };

const ASSIGNMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 10 * 1024 * 1024;

export function receiptPdfPath(assignmentId: string): string | null {
  return ASSIGNMENT_ID.test(assignmentId) ? `/api/v1/student/assignments/${assignmentId.toLowerCase()}/submission/pdf` : null;
}

export async function fetchReceiptPdf(
  assignmentId: string,
  options: { readonly fetchImpl?: typeof fetch; readonly signal?: AbortSignal } = {},
): Promise<ReceiptPdfOutcome> {
  const path = receiptPdfPath(assignmentId);
  if (path === null) return { kind: "notFound" };
  let response: Response;
  try {
    response = await (options.fetchImpl ?? browserTransport)(path, {
      method: "GET", credentials: "same-origin", headers: { accept: "application/pdf" }, signal: options.signal,
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (response.status === 401) return { kind: "signedOut" };
  if (response.status === 404 || response.status === 403) return { kind: "notFound" };
  if (response.status !== 200) return { kind: "unavailable" };
  if (!(response.headers.get("content-type") ?? "").toLowerCase().startsWith("application/pdf")) return { kind: "unavailable" };
  try {
    const blob = await response.blob();
    return blob.size > 0 && blob.size <= MAX_BYTES ? { kind: "ok", blob } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export type PdfDownloadState = "idle" | "loading" | "notFound" | "signedOut" | "failed";

/** One click: fetch, save, and say what the page shows afterwards. */
export async function runReceiptPdfDownload(
  fetchPdf: () => Promise<ReceiptPdfOutcome>,
  save: (blob: Blob) => void,
): Promise<PdfDownloadState> {
  const outcome = await fetchPdf();
  if (outcome.kind === "ok") {
    try { save(outcome.blob); } catch { return "failed"; }
    return "idle";
  }
  return outcome.kind === "unavailable" ? "failed" : outcome.kind;
}

export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
