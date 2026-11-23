/**
 * The reading side of the live view (WEB-34; DAN-86 with D-142;
 * live.document.get, contract 2.9.1). Ported
 * from Ductus src/client/live-reader.ts at 0cdb0f1 onto createApi: the
 * request goes through the contract's client under `ductus-protocol` "1",
 * and the transport it is given only adds `if-none-match` (the contract's
 * RequestSpec names no request headers yet) and keeps the raw answer, since
 * a document is shown only from its exact bytes.
 *
 * The teacher of the assignment, and the student in the same view, read the
 * last state the student published: one canonical document, never a step,
 * a key or a time. A response is shown only when its bytes are the exact JCS
 * text of a valid document whose SHA-256 equals the ETag; anything else is
 * unavailable, never shown in part. The reader keeps the last document it
 * accepted, so a lost connection only marks the reader's own connection.
 *
 * Timing (4.12 t. 7): one request in flight, the next one second after the
 * last answer while the page is visible, and after a failure a back-off from
 * two seconds doubling up to thirty. These are client constants, not the
 * thresholds P-01 to P-04, and the page never shows them.
 *
 * Document v3 (INT-26): a v3 sheet publishes its v3 document, so the reader
 * accepts exactly v1 and v3, each by its own validator and still only from
 * the exact JCS bytes whose SHA-256 is the ETag. A v2 document stays
 * unavailable here, as before (the host's text elements read it).
 */

import type { LiveDocument } from "./live-publisher";
import { verifyVersionedDocumentSnapshot } from "../../packages/editor-core/src/document/document/snapshot";

import { browserTransport, createApi, type ApiResult, type ProtocolVersion } from "./api";

const LIVE_PROTOCOL = "1" satisfies ProtocolVersion;

/** The transport createApi is handed: the browser's by default, a test's own. */
type Transport = typeof browserTransport;

export type LiveRead =
  | { kind: "state"; hash: string; document: LiveDocument; submitted: boolean }
  | { kind: "unchanged"; submitted: boolean }
  | { kind: "empty" }
  | { kind: "signedOut" | "notFound" | "unavailable" };

const ETAG = /^"([0-9a-f]{64})"$/;

/**
 * The header the route sets on the bytes of the submitted revision (DAN-332,
 * #826 PR 2, `LIVE_STATE_HEADER` of the route). Only the exact value
 * `submitted` counts; any other value, or none, is the live state.
 */
export const LIVE_STATE_HEADER = "ductus-live-state";

export const LIVE_READ_INTERVAL_MS = 1000;
export const LIVE_RETRY_FIRST_MS = 2000;
export const LIVE_RETRY_MAX_MS = 30_000;

/** The raw answer the transport kept: status, the two headers the reader reads, and the bytes of a 200. */
type RawAnswer = { status: number; etag: string | null; state: string | null; bytes: Uint8Array | null };

/** One read of the live state; `knownHash` is the hash of the document already shown. */
export async function readLiveState(
  documentId: string,
  knownHash: string | null,
  fetcher: Transport = browserTransport,
  baseUrl?: string,
): Promise<LiveRead> {
  let raw: RawAnswer | null = null;
  const transport: Transport = async (input, init) => {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
    if (knownHash !== null) headers["if-none-match"] = `"${knownHash}"`;
    const response = await fetcher(input, { ...init, headers, credentials: "same-origin", cache: "no-store" });
    raw = {
      status: response.status,
      etag: response.headers.get("etag"),
      state: response.headers.get(LIVE_STATE_HEADER),
      bytes: response.status === 200 ? new Uint8Array(await response.clone().arrayBuffer()) : null,
    };
    return response;
  };
  let result: ApiResult<"live.document.get">;
  try {
    result = await createApi({ fetchImpl: transport, protocol: LIVE_PROTOCOL, ...(baseUrl === undefined ? {} : { baseUrl }) })(
      "live.document.get", { params: { documentId }, query: undefined, body: undefined },
    );
  } catch {
    return { kind: "unavailable" };
  }
  const answer = raw as RawAnswer | null;
  // Nothing went out (the contract refused the id) or the client found the answer outside the contract.
  if (answer === null) return { kind: "unavailable" };
  const etag = ETAG.exec(answer.etag ?? "")?.[1] ?? null;
  const submitted = answer.state === "submitted";
  if (!result.ok) {
    if (answer.status === 401) return { kind: "signedOut" };
    return { kind: answer.status === 404 ? "notFound" : "unavailable" };
  }
  switch (answer.status) {
    case 200: {
      if (etag === null || answer.bytes === null) return { kind: "unavailable" };
      const snapshot = await verifyVersionedDocumentSnapshot(answer.bytes);
      if (!snapshot.ok || snapshot.sha256 !== etag) return { kind: "unavailable" };
      const document = snapshot.document;
      if (document.schemaVersion !== 1 && document.schemaVersion !== 3) return { kind: "unavailable" };
      return { kind: "state", hash: snapshot.sha256, document, submitted };
    }
    // A 304 means "the document you hold": only true when one was named and it is that one.
    case 304: return knownHash !== null && etag === knownHash ? { kind: "unchanged", submitted } : { kind: "unavailable" };
    case 204: return { kind: "empty" };
    default: return { kind: "unavailable" };
  }
}

export type LiveConnection = "loading" | "live" | "retrying" | "paused" | "signedOut" | "notFound";

export type LiveView = {
  /** The last document accepted from the route; kept through failures. */
  readonly document: LiveDocument | null;
  readonly hash: string | null;
  /** True once the route said the student has published nothing yet. */
  readonly empty: boolean;
  /** The state of this reader's own requests, never a statement about the student. */
  readonly connection: LiveConnection;
  /**
   * The shown document is the submitted revision (DAN-332, #826 PR 3): the
   * route sent exactly these bytes, or named them in a 304, as `submitted`.
   * Once true it stays: no later answer replaces the text or makes it live.
   */
  readonly submitted: boolean;
};

/** Page visibility as the reader needs it; a test passes its own. */
export type VisibilitySource = {
  isVisible(): boolean;
  subscribe(onChange: () => void): () => void;
};

export type LiveReaderOptions = {
  readonly documentId: string;
  readonly onChange: (view: LiveView) => void;
  /**
   * Asked before every request: a reader whose sign-in has since ended in
   * this browser stops instead of sending a cookie that may be another
   * person's (as comments, F-093).
   */
  readonly current?: () => boolean;
  readonly fetcher?: Transport;
  /** Origin of the API; the page's own origin by default (tests). */
  readonly baseUrl?: string;
  readonly visibility?: VisibilitySource;
  readonly timers?: {
    set(run: () => void, ms: number): unknown;
    clear(handle: unknown): void;
  };
};

const documentVisibility: VisibilitySource = {
  isVisible: () => document.visibilityState === "visible",
  subscribe(onChange) {
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  },
};

const windowTimers = {
  set: (run: () => void, ms: number): unknown => setTimeout(run, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Starts polling and returns the function that stops it for good. */
export function startLiveReader(options: LiveReaderOptions): () => void {
  const current = options.current ?? (() => true);
  const fetcher = options.fetcher ?? browserTransport;
  const visibility = options.visibility ?? documentVisibility;
  const timers = options.timers ?? windowTimers;

  let view: LiveView = { document: null, hash: null, empty: false, connection: "loading", submitted: false };
  let stopped = false;
  let inFlight = false;
  let timer: unknown = null;
  let retryMs = 0;

  const publish = (next: Partial<LiveView>) => {
    view = { ...view, ...next };
    options.onChange(view);
  };
  const terminal = () => view.connection === "signedOut" || view.connection === "notFound";

  const schedule = (ms: number) => {
    if (stopped || terminal()) return;
    if (timer !== null) timers.clear(timer);
    timer = timers.set(() => {
      timer = null;
      void tick();
    }, ms);
  };

  async function tick(): Promise<void> {
    if (stopped || terminal() || inFlight) return;
    if (!visibility.isVisible()) {
      publish({ connection: "paused" });
      return;
    }
    if (!current()) {
      publish({ connection: "signedOut" });
      return;
    }
    inFlight = true;
    const read = await readLiveState(options.documentId, view.hash, fetcher, options.baseUrl);
    inFlight = false;
    if (stopped) return;
    switch (read.kind) {
      // Once the submitted revision is shown, no answer replaces it (#826 A5);
      // only the connection is kept, so 401, 404 and the session end still clear it.
      case "state":
        retryMs = 0;
        if (view.submitted) {
          if (view.connection !== "live") publish({ connection: "live" });
          break;
        }
        publish({ document: read.document, hash: read.hash, empty: false, connection: "live", submitted: read.submitted });
        break;
      case "unchanged":
        retryMs = 0;
        // A3: the submitted revision is the document already shown.
        if (read.submitted && !view.submitted) publish({ connection: "live", submitted: true });
        else if (view.connection !== "live") publish({ connection: "live" });
        break;
      case "empty":
        retryMs = 0;
        if (view.submitted) {
          if (view.connection !== "live") publish({ connection: "live" });
          break;
        }
        publish({ document: null, hash: null, empty: true, connection: "live" });
        break;
      case "signedOut":
      case "notFound":
        publish({ connection: read.kind });
        return;
      case "unavailable":
        retryMs = retryMs === 0 ? LIVE_RETRY_FIRST_MS : Math.min(retryMs * 2, LIVE_RETRY_MAX_MS);
        publish({ connection: "retrying" });
        schedule(retryMs);
        return;
    }
    schedule(LIVE_READ_INTERVAL_MS);
  }

  const unsubscribe = visibility.subscribe(() => {
    // Back on screen: read now rather than wait out a timer set while hidden.
    if (visibility.isVisible() && !inFlight) schedule(0);
  });
  void tick();

  return () => {
    stopped = true;
    unsubscribe();
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
}
