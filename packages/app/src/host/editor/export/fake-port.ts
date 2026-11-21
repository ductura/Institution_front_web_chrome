// An in-memory server for the preparation flow (WEB-1803), invented data. Tests only.
import { pdfDownloadPrefix } from "./contract";
import type { PrepareCalls, Raw } from "./preparation";

export const FILE_ID = "00000000-0000-4000-8000-0000000000f1";
export const PREFIX = pdfDownloadPrefix("doc-1");
export const BYTES = new TextEncoder().encode("%PDF-1.7 invented test file");
export const BYTES_SHA = "e19ae5cd0e8d54f6c5b1d1c0cb21ee2b0d01bb4d6dd5d3ff1ca1b83b0bd6b6e9";

export type Script = { readonly state: "queued" | "ready" | "failed" | "expired"; readonly pdfA?: unknown; readonly extra?: Record<string, unknown> };

const ok = (body: unknown, status = 200): Raw => ({ ok: true, status, body });
const answer = (step: Script, sha: string) => ({
  id: FILE_ID, state: step.state,
  ...(step.state === "ready" ? { downloadPath: `${PREFIX}${FILE_ID}`, sha256: sha } : {}),
  ...(step.pdfA !== undefined ? { pdfA: step.pdfA } : {}),
  ...step.extra,
});

/** `steps[0]` answers the start, the next ones the reads (the last repeats). */
export function fakePreparation(steps: readonly Script[], sha = BYTES_SHA) {
  const seen = { starts: 0, reads: 0, cancels: [] as string[], keys: [] as string[] };
  const calls = (key = "test-request-key"): PrepareCalls => ({
    start: async () => { seen.starts += 1; seen.keys.push(key); return ok(answer(steps[0] as Script, sha), 202); },
    read: async () => { seen.reads += 1; return ok(answer(steps[Math.min(seen.reads, steps.length - 1)] as Script, sha)); },
    cancel: async (id) => { seen.cancels.push(id); return ok(null, 204); },
  });
  return { calls, seen };
}
