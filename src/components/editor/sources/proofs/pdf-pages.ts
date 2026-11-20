/// <reference path="./pdf-worker.d.ts" />
/**
 * A PDF opened in the browser only (E§3.4 proofs: "PDF ostaje na Vašem
 * uređaju"). pdf.js runs on the main thread (its worker module is handed over
 * as `globalThis.pdfjsWorker`), so no worker script is loaded, and the file
 * is given as bytes with every fetching option off: no range, stream, fonts
 * or CMaps are requested. The proofs dialog loads this module only when the
 * student picks a PDF (`import("./pdf-pages")`).
 */

import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import * as worker from "pdfjs-dist/build/pdf.worker.mjs";

import { pictureOf, type ProofPicture } from "./crop";
import type { TextRun } from "./quote-match";

/** The prototype renders a page at scale 2 so the cut-out stays sharp. */
export const RENDER_SCALE = 2;
/** At most this many pages are searched for a quote (prototype 600). */
export const SEARCH_MAX = 600;

export type PdfPage = { readonly picture: ProofPicture; readonly runs: readonly TextRun[] };
export type PdfPages = {
  readonly count: number;
  readonly page: (n: number) => Promise<PdfPage>;
  /** The text runs of page n without drawing it (the search through pages). */
  readonly text: (n: number) => Promise<readonly TextRun[]>;
  readonly close: () => Promise<void>;
};

type Item = { str?: string; transform?: number[]; width?: number; height?: number };

let ready = false;
function mainThreadWorker() {
  if (ready) return;
  globalThis.pdfjsWorker = worker;
  ready = true;
}

type Viewport = { convertToViewportRectangle: (rect: number[]) => number[] };

/** Text runs in the pixels of the page rendered with `viewport`. */
export function runsOf(items: readonly Item[], viewport: Viewport): TextRun[] {
  const runs: TextRun[] = [];
  for (const raw of items) {
    if (typeof raw.str !== "string" || raw.str.trim() === "" || !raw.transform) continue;
    const e = raw.transform[4] ?? 0;
    const f = raw.transform[5] ?? 0;
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = viewport.convertToViewportRectangle([e, f, e + (raw.width ?? 0), f + (raw.height || 10)]);
    runs.push({ str: raw.str, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
  }
  return runs;
}

/** Opens a PDF from its bytes; throws when pdf.js cannot read it. */
export async function openPdf(bytes: ArrayBuffer): Promise<PdfPages> {
  mainThreadWorker();
  const doc: PDFDocumentProxy = await getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    useWorkerFetch: false,
    enableXfa: false,
    stopAtErrors: false,
  }).promise;
  const clampPage = (n: number) => Math.min(doc.numPages, Math.max(1, Math.trunc(n)));
  return {
    count: doc.numPages,
    page: async (n) => {
      const page = await doc.getPage(clampPage(n));
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("canvas");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const runs = runsOf((await page.getTextContent()).items as Item[], viewport);
      page.cleanup();
      return { picture: pictureOf(canvas), runs };
    },
    text: async (n) => {
      const page = await doc.getPage(clampPage(n));
      const runs = runsOf((await page.getTextContent()).items as Item[], page.getViewport({ scale: RENDER_SCALE }));
      page.cleanup();
      return runs;
    },
    close: () => doc.destroy(),
  };
}
