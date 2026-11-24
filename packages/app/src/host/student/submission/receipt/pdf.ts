// NF-3 PR-12 (E-11a, PO-43): "Preuzmi zapis (PDF s QR kodom)" saves the receipt's PDF
// (student.receipt-pdf.get), the one record a student saves in the pilot. The server builds the file
// and its QR code; the browser only decodes and saves it. Every failure is one message (PR-12).
import type { createApi } from "../../../../../../../src/client/api.ts";

type Call = ReturnType<typeof createApi>;

export type PdfOutcome =
  | { readonly kind: "ok"; readonly blob: Blob; readonly filename: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "failed" };

/** One read of the receipt's PDF for a work, as a file to save or what went wrong. */
export async function receiptPdf(call: Call, assignmentId: string): Promise<PdfOutcome> {
  try {
    const answer = await call("student.receipt-pdf.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!answer.ok) return answer.status === 401 ? { kind: "signedOut" } : { kind: "failed" };
    const raw = atob(answer.body.pdfBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return { kind: "ok", blob: new Blob([bytes], { type: "application/pdf" }), filename: answer.body.filename };
  } catch {
    return { kind: "failed" };
  }
}
