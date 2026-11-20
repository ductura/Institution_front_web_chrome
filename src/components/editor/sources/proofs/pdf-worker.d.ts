// pdf.js ships no types for its worker module; the proofs dialog only hands it over (pdf-pages.ts).
declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}

// pdf.js looks here for a worker that runs on the main thread (no Worker, no worker script).
declare var pdfjsWorker: unknown;
