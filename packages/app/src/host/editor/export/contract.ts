// WEB-1803, WEB-2005: what the export screens share. The PDF itself comes through work.export-pdf.get (see pdf.ts);
// the submission package still downloads a prepared file from the path the server gave.
import { browserTransport } from "../../../../../../src/client/api";
import type { DownloadResult } from "./preparation";

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
