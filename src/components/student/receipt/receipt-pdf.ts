/**
 * The PDF record of a signed receipt (S: PO-21; student.receipt-pdf.get,
 * GET .../submission/pdf). The server builds the file and its QR code; the
 * browser only receives and saves it.
 *
 * TODO(ugovor): the route is not in the generated contract of this base yet,
 * so there is no client call; the page injects it. Every answer maps onto one
 * closed table; a 404 is a message, never an empty page.
 */

export type ReceiptPdfOutcome =
  | { readonly kind: "ok"; readonly blob: Blob }
  | { readonly kind: "notFound" | "signedOut" | "unavailable" };

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * One answer of the route as an outcome. The request itself is made by the
 * client (src/client, the only place that calls the API), which is not
 * written yet because the route is not in the contract of this base; the
 * page passes the answer here.
 */
export async function receiptPdfOutcome(response: Response): Promise<ReceiptPdfOutcome> {
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

/** One click: ask, save, and say what the page shows afterwards. */
export async function runReceiptPdfDownload(
  loadPdf: () => Promise<ReceiptPdfOutcome>,
  save: (blob: Blob) => void,
): Promise<PdfDownloadState> {
  const outcome = await loadPdf();
  if (outcome.kind === "ok") {
    try { save(outcome.blob); } catch { return "failed"; }
    return "idle";
  }
  return outcome.kind === "unavailable" ? "failed" : outcome.kind;
}
