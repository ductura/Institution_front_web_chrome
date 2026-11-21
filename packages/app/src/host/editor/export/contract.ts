// WEB-1803 (M8.5): the PDF of one saved version of a work. TODO(ugovor): the routes are not in
// @ductura/contracts yet. Smallest shapes the plan gives (see preparation.ts for the answer):
//   student.work-pdf-export.post         { documentId, versionId, requestKey } -> 202 answer (the same key is the same preparation)
//   student.work-pdf-export.get          { documentId, exportId }              -> 200 answer
//   student.work-pdf-export-cancel.post  { documentId, exportId }              -> 204
//   GET <downloadPath> under the exports of the work in the server prefix              -> the file
import { browserTransport, SERVER_PREFIX } from "../../../../../../src/client/api";
import type { DownloadResult, PrepareCalls, Raw } from "./preparation";

export type PrepareCall = (
  id: "student.work-pdf-export.post" | "student.work-pdf-export.get" | "student.work-pdf-export-cancel.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<Raw>;

/** A download path of this work's exports and nothing else. */
export const pdfDownloadPrefix = (documentId: string): string => `${SERVER_PREFIX}works/${encodeURIComponent(documentId)}/exports/`;

export function pdfCalls(call: PrepareCall, documentId: string, versionId: string, requestKey: string): PrepareCalls {
  return {
    start: (): Promise<Raw> => call("student.work-pdf-export.post", { body: { documentId, versionId, requestKey } }),
    read: (exportId): Promise<Raw> => call("student.work-pdf-export.get", { params: { documentId, exportId } }),
    cancel: (exportId) => call("student.work-pdf-export-cancel.post", { params: { documentId, exportId } }),
  };
}

/** The browser downloads the file from the path the server gave, with the session's cookie. */
export async function downloadFromServer(path: string, signal: AbortSignal): Promise<DownloadResult> {
  const response = await browserTransport(path, {
    method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
  });
  return response.ok ? { ok: true, blob: await response.blob() } : { ok: false, status: response.status };
}

export function pdfFileName(title: string): string {
  const name = title.trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/[. ]+$/u, "");
  return `${name || "rad"}.pdf`;
}
