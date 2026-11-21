// WEB-1803 (M8.5, M8.6): the preparation of a file on the server (the PDF of a work, the package
// for the registrar's office) as one flow: ask, read the state until it is ready, or stop when the
// student gives up. Every state is the server's answer (B-6): the PDF/A mark exists only when a
// ready answer says `pdfA: true`, a download path is trusted only when it has the shape the
// contract gives, and a file counts as downloaded only when its SHA-256 matches the server's.
// TODO(ugovor): the routes are not in @ductura/contracts yet; the shapes are the smallest the
// plan gives, and createApi answers "client_rejected" to them, so the screen says "unavailable".
// This module makes no request of its own: it reaches the server only through the calls it is given.

export type Raw =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly code?: string };

/** The three calls of one preparation; the request key of the start lives in `start`. */
export type PrepareCalls = {
  start(signal: AbortSignal): Promise<Raw>;
  read(id: string, signal: AbortSignal): Promise<Raw>;
  /** Best effort: the preparation may already be over. */
  cancel(id: string): Promise<unknown>;
};

export type Answer = {
  readonly id: string;
  readonly state: "queued" | "ready" | "failed" | "expired";
  /** True only in a ready answer that says so. */
  readonly pdfA: boolean;
  readonly downloadPath: string | null;
  readonly sha256: string | null;
};

export type ReadyFile = {
  readonly id: string;
  readonly pdfA: boolean;
  readonly downloadPath: string;
  readonly sha256: string;
};

export type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "preparing" }
  | { readonly kind: "ready"; readonly file: ReadyFile }
  | { readonly kind: "failed" }
  | { readonly kind: "expired" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "session-expired" }
  /** 408, 503, a broken connection, any other shape: the preparation may exist; the same key asks again. */
  | { readonly kind: "unknown" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const KEYS = new Set(["id", "state", "pdfA", "downloadPath", "sha256"]);
const STATES = new Set(["queued", "ready", "failed", "expired"]);
export const REQUEST_KEY = /^[A-Za-z0-9_-]{8,128}$/;

/** A new request key: one per preparation; an unknown outcome asks again with the same key. */
export function newRequestKey(random: () => string = () => crypto.randomUUID()): string {
  const key = random();
  if (!REQUEST_KEY.test(key)) throw new Error("request key out of the contract");
  return key;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A closed shape; anything else is not an answer. A ready answer must carry its path and fingerprint. */
export function parseAnswer(body: unknown, downloadPrefix: string): Answer | null {
  if (!record(body) || Object.keys(body).some((key) => !KEYS.has(key))) return null;
  const { id, state, pdfA, downloadPath, sha256 } = body;
  if (typeof id !== "string" || !UUID.test(id) || typeof state !== "string" || !STATES.has(state)) return null;
  if (pdfA !== undefined && typeof pdfA !== "boolean") return null;
  if (downloadPath !== undefined && downloadPath !== null && typeof downloadPath !== "string") return null;
  if (sha256 !== undefined && sha256 !== null && (typeof sha256 !== "string" || !SHA256.test(sha256))) return null;
  const path = typeof downloadPath === "string" ? downloadPath : null;
  const digest = typeof sha256 === "string" ? sha256 : null;
  if (state === "ready") {
    if (path === null || digest === null || !path.startsWith(downloadPrefix) || path.includes("..") || path.includes("?")) return null;
  }
  return { id, state: state as Answer["state"], pdfA: state === "ready" && pdfA === true, downloadPath: path, sha256: digest };
}

export type RunOptions = {
  readonly signal: AbortSignal;
  /** The prefix a download path must have (the contract's path of this file, with its ids). */
  readonly downloadPrefix: string;
  readonly intervalMs?: number;
  readonly maxReads?: number;
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); }
    signal.addEventListener("abort", done, { once: true });
  });
}

function fromFailure(result: Extract<Raw, { ok: false }>): Phase {
  return result.status === 401 ? { kind: "session-expired" } : { kind: "unknown" };
}

function fromAnswer(answer: Answer): Phase | null {
  if (answer.state === "ready") {
    return { kind: "ready", file: { id: answer.id, pdfA: answer.pdfA, downloadPath: answer.downloadPath as string, sha256: answer.sha256 as string } };
  }
  if (answer.state === "failed") return { kind: "failed" };
  if (answer.state === "expired") return { kind: "expired" };
  return null;
}

/**
 * One preparation, start to end. The student's "Odustani" aborts the signal: the reads stop and the
 * server is told once, when it already gave an id. Returns the last phase.
 */
export async function runPreparation(calls: PrepareCalls, options: RunOptions): Promise<Phase> {
  const { signal, downloadPrefix } = options;
  const interval = options.intervalMs ?? 1500;
  const maxReads = options.maxReads ?? 120;
  const wait = options.wait ?? waitFor;
  let id: string | null = null;
  const stopped = (): Phase => {
    if (id !== null) void calls.cancel(id).catch(() => undefined);
    return { kind: "cancelled" };
  };
  try {
    const started = await calls.start(signal);
    if (signal.aborted) {
      const late = started.ok ? parseAnswer(started.body, downloadPrefix) : null;
      id = late?.id ?? null;
      return stopped();
    }
    if (!started.ok) return fromFailure(started);
    if (started.status !== 200 && started.status !== 202) return { kind: "unknown" };
    let answer = parseAnswer(started.body, downloadPrefix);
    if (!answer) return { kind: "unknown" };
    id = answer.id;
    for (let reads = 0; ; reads += 1) {
      const phase = fromAnswer(answer);
      if (phase) return phase;
      if (reads >= maxReads) return { kind: "unknown" };
      await wait(interval, signal);
      if (signal.aborted) return stopped();
      const read = await calls.read(id, signal);
      if (signal.aborted) return stopped();
      if (!read.ok) return fromFailure(read);
      const next = read.status === 200 ? parseAnswer(read.body, downloadPrefix) : null;
      if (!next || next.id !== id) return { kind: "unknown" };
      answer = next;
    }
  } catch {
    return signal.aborted ? stopped() : { kind: "unknown" };
  }
}

export type DownloadResult =
  | { readonly ok: true; readonly blob: Blob }
  | { readonly ok: false; readonly status: number };

export type Downloaded =
  | { readonly kind: "downloaded"; readonly blob: Blob }
  | { readonly kind: "failed" }
  | { readonly kind: "mismatch" }
  | { readonly kind: "session-expired" };

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The file of a ready preparation; it counts only when its SHA-256 is the one the server named. */
export async function fetchPrepared(
  download: (path: string, signal: AbortSignal) => Promise<DownloadResult>,
  file: ReadyFile,
  signal: AbortSignal,
): Promise<Downloaded> {
  try {
    const result = await download(file.downloadPath, signal);
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : { kind: "failed" };
    return (await sha256Hex(result.blob)) === file.sha256 ? { kind: "downloaded", blob: result.blob } : { kind: "mismatch" };
  } catch {
    return { kind: "failed" };
  }
}

/** What the screen draws as "PDF/A": only a ready PDF whose server answer said so. */
export function showsPdfA(phase: Phase): boolean {
  return phase.kind === "ready" && phase.file.pdfA;
}
