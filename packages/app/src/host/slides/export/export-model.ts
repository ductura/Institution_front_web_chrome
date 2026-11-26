// WEB-V13-IZVOZ: the export of a slides work through work.export-slides.get
// (GET works/{documentId}/export-slides?format=pptx|pdf&versionId=; Institution_server f3170646).
// One GET answers with the bytes and the header x-export-snapshot-sha256 (the digest of the frozen snapshot).
// createApi reads no binary body, so the request goes through the shared browser transport, as the DOCX
// export does (src/client/work-export.ts). Every refusal is a state of its own, never an empty file.
import { browserTransport, SERVER_PREFIX } from "../../../../../../src/client/api";
import { slidesExportText as t } from "./messages.hr.ts";

export type ExportFormat = "pptx" | "pdf";

export const MIME: Readonly<Record<ExportFormat, string>> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

/** The wait after which a preparation counts as expired (the contract names no separate state for it). */
export const EXPORT_TIMEOUT_MS = 120_000;

export type ExportResult =
  | { readonly kind: "ready"; readonly blob: Blob; readonly snapshotSha256: string; readonly format: ExportFormat }
  | { readonly kind: "signed-out" }
  | { readonly kind: "not-found" }
  | { readonly kind: "invalid" }
  | { readonly kind: "mismatch" }
  | { readonly kind: "expired" }
  | { readonly kind: "failed" };

export type Transport = typeof browserTransport;

const SHA256 = /^[0-9a-f]{64}$/i;
const VERSION_ID = /^[1-9][0-9]{0,15}$/;

/** A file name from the title of the work; characters a file system refuses become "_". */
export function exportFileName(title: string | null, format: ExportFormat): string {
  const name = (title ?? "").trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/[. ]+$/u, "");
  return `${name || t.fallbackName}.${format}`;
}

/** The request path; `versionId` is left out when the server is to export its last confirmed revision. */
export function exportPath(documentId: string, format: ExportFormat, versionId: string | null): string {
  const query = new URLSearchParams({ format });
  if (versionId !== null) query.set("versionId", versionId);
  return `${SERVER_PREFIX}works/${encodeURIComponent(documentId)}/export-slides?${query}`;
}

/** Reads one export. `timeoutMs` ends a wait as "expired"; `signal` ends it as the caller's own abort ("failed"). */
export async function requestSlidesExport(
  documentId: string,
  format: ExportFormat,
  versionId: string | null,
  options: { readonly signal?: AbortSignal; readonly request?: Transport; readonly timeoutMs?: number } = {},
): Promise<ExportResult> {
  if (documentId === "" || (versionId !== null && !VERSION_ID.test(versionId))) return { kind: "invalid" };
  const { signal, request = browserTransport, timeoutMs = EXPORT_TIMEOUT_MS } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await request(exportPath(documentId, format, versionId), {
      method: "GET",
      headers: { Accept: MIME[format] },
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    if (response.status === 401) return { kind: "signed-out" };
    if (response.status === 404) return { kind: "not-found" };
    if (response.status === 422) return { kind: "invalid" };
    if (!response.ok || response.status !== 200) return { kind: "failed" };
    const sha = response.headers.get("x-export-snapshot-sha256");
    const type = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (type !== MIME[format] || sha === null || !SHA256.test(sha)) return { kind: "mismatch" };
    const blob = await response.blob();
    if (blob.size === 0) return { kind: "mismatch" };
    return { kind: "ready", blob, snapshotSha256: sha.toLowerCase(), format };
  } catch {
    return timeout.aborted ? { kind: "expired" } : { kind: "failed" };
  }
}
