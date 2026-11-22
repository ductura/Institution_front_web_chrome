// WEB-2005: the PDF of a work through work.export-pdf.get (Institution_server 9e67d7c, API 1.75.0).
// One GET answers with the bytes: there is nothing to prepare, poll or cancel. The server exports the
// submitted or the last saved revision. The "PDF/A" mark comes only from the server's own word
// (format "pdfa-2u" with a report hash), and the bytes count only when their SHA-256 is the one it named.
// This module makes no request of its own: it reaches the server only through the call it is given.
import type { Raw } from "./preparation";

export type PdfInput = {
  readonly params: { readonly assignmentId: string; readonly documentId: string };
  readonly query: undefined;
  readonly body: undefined;
};

export type PdfCall = (id: "work.export-pdf.get", input: PdfInput) => Promise<Raw>;

export type PdfResult =
  | { readonly kind: "ready"; readonly bytes: Uint8Array<ArrayBuffer>; readonly sha256: string; readonly pdfA: boolean }
  | { readonly kind: "signed-out" }
  | { readonly kind: "not-found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "mismatch" }
  | { readonly kind: "unavailable" };

const SHA256 = /^[0-9a-f]{64}$/;
const PDF_BASE64 = /^JVBERi0[A-Za-z0-9+/]*={0,2}$/;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function decodeBase64(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromFailure(result: Extract<Raw, { ok: false }>): PdfResult {
  if (result.status === 401) return { kind: "signed-out" };
  if (result.status === 403) return { kind: "forbidden" };
  if (result.status === 404) return { kind: "not-found" };
  return { kind: "unavailable" };
}

/** Reads the PDF of one work. Any shape the contract does not give is "unavailable", never a file. */
export async function readPdf(call: PdfCall, assignmentId: string, documentId: string): Promise<PdfResult> {
  let result: Raw;
  try {
    result = await call("work.export-pdf.get", { params: { assignmentId, documentId }, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) return fromFailure(result);
  if (result.status !== 200 || !record(result.body)) return { kind: "unavailable" };
  const { pdfBase64, outputSha256, format, reportHash } = result.body;
  if (typeof pdfBase64 !== "string" || !PDF_BASE64.test(pdfBase64)) return { kind: "unavailable" };
  if (typeof outputSha256 !== "string" || !SHA256.test(outputSha256)) return { kind: "unavailable" };
  if (format !== "pdf" && format !== "pdfa-2u") return { kind: "unavailable" };
  const bytes = decodeBase64(pdfBase64);
  if (bytes === null) return { kind: "unavailable" };
  if ((await sha256Hex(bytes)) !== outputSha256) return { kind: "mismatch" };
  const pdfA = format === "pdfa-2u" && typeof reportHash === "string" && SHA256.test(reportHash);
  return { kind: "ready", bytes, sha256: outputSha256, pdfA };
}
