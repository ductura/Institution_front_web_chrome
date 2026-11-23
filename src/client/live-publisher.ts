/**
 * The publishing side of the live view (B-LIVE step 4, DAN-216).
 *
 * The student's tab that holds the document publishes the last state of the
 * work: the whole canonical document as RFC 8785 JCS bytes, never a step, a
 * key, a range or a time (4.12 t. 1, PRODUCT §5 rule 4). This is not the
 * evidence: it touches neither the journal nor the drain, and SYNCED still
 * means only a signed evidence receipt.
 *
 * Timing (4.12 t. 7 and t. 8): one request in flight; changes meanwhile
 * merge into the last state; a new request starts at the earliest one second
 * after the start of the previous one, and only when the bytes differ from
 * what the route holds (known only while nothing is in flight and the last
 * answer was definite, so a return to the accepted state during a request,
 * or after a lost or aborted answer, still goes). Without a network only
 * the last state waits, and it goes when the network is back. A conflict
 * takes the returned token and sends the last state once more, never twice
 * for the same state: offering those bytes again does not renew the retry,
 * only different bytes actually sent do. 401 and 404 (no session, notice not
 * confirmed, no right to publish) stop publishing until the page loads again.
 * These are client constants, not the thresholds P-01 to P-04.
 *
 * Document v3 (INT-26): a v3 sheet publishes its v3 document through this
 * same publisher, under the same gate (`livePublishAllowed`, which does not
 * read the version) and the same timing; the bytes are its JCS text exactly
 * as for v1, so a v1 document goes out byte for byte as before.
 */

import type { CanonicalDocument, CanonicalDocumentV3 } from "../../packages/editor-core/src/document/document";
import { canonicalizeJcs } from "../../packages/editor-core/src/document/forensics/jcs";

import { cookieTransport, createApi, type ApiOptions, type Input } from "./api";

export const LIVE_PUBLISH_GAP_MS = 1000;
export const LIVE_PUBLISH_RETRY_FIRST_MS = 2000;
export const LIVE_PUBLISH_RETRY_MAX_MS = 30_000;

/** What a sheet publishes: the v1 document, or the v3 one of a confirmed v3 work (INT-26). */
export type LiveDocument = CanonicalDocument | CanonicalDocumentV3;

/**
 * Whether a tab may publish at all (O2, #756): only a signed-in person who
 * acknowledged the notice, and never a submitted work. The document's version
 * is deliberately not an input: a v3 work publishes under exactly the rules of
 * a v1 one (INT-26).
 */
export function livePublishAllowed(gate: {
  readonly signedIn: boolean;
  readonly noticeAcknowledged: boolean;
  readonly submitted: boolean;
}): boolean {
  return gate.signedIn && gate.noticeAcknowledged && !gate.submitted;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The network as the publisher needs it; a test passes its own. */
export type NetworkSource = {
  isOnline(): boolean;
  subscribe(onChange: () => void): () => void;
};

export type LivePublisherOptions = {
  readonly documentId: string;
  /**
   * Asked before every request: once the sign-in of this tab has ended, the
   * publisher stops for good rather than send a cookie that may be another
   * person's (as the reader and comments, F-093).
   */
  readonly current?: () => boolean;
  /**
   * Asked before every request, ahead of `current`: while it is true (the
   * page shows the teacher view, #882) nothing goes out and the last state
   * waits; it is not a halt. A timer that comes due before the page has
   * stopped the publisher is held here, not by the order of React effects.
   */
  readonly held?: () => boolean;
  readonly fetcher?: ApiOptions["fetchImpl"];
  readonly network?: NetworkSource;
  readonly now?: () => number;
  readonly timers?: {
    set(run: () => void, ms: number): unknown;
    clear(handle: unknown): void;
  };
};

export type LivePublisher = {
  /** The document as it is now; only the last one offered is ever sent. */
  offer(document: LiveDocument): void;
  /** Lets requests go out; may be called again after `stop`. */
  start(): void;
  /** No request starts after this, and one in flight is aborted. */
  stop(): void;
  /** Why publishing has ended for this page, if it has. */
  halted(): "signedOut" | "notFound" | null;
};

const browserNetwork: NetworkSource = {
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
  subscribe(onChange) {
    window.addEventListener("online", onChange);
    return () => window.removeEventListener("online", onChange);
  },
};

const windowTimers = {
  set: (run: () => void, ms: number): unknown => setTimeout(run, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** A stopped publisher; `start` lets it send. */
export function createLivePublisher(options: LivePublisherOptions): LivePublisher {
  const current = options.current ?? (() => true);
  const held = options.held ?? (() => false);
  const transport = cookieTransport("", options.fetcher);
  const network = options.network ?? browserNetwork;
  const now = options.now ?? (() => Date.now());
  const timers = options.timers ?? windowTimers;

  let running = false;
  let halt: "signedOut" | "notFound" | null = null;
  let pending: string | null = null;
  let accepted: string | null = null;
  let refused: string | null = null;
  let token: string | null = null;
  let inFlight: AbortController | null = null;
  let timer: unknown = null;
  let lastStart = Number.NEGATIVE_INFINITY;
  let retryMs = 0;
  let conflicted: string | null = null;
  let exhausted: string | null = null;
  let unsubscribe: (() => void) | null = null;

  const clearTimer = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  const schedule = (delay = 0) => {
    if (!running || halt !== null || inFlight !== null || timer !== null || pending === null) return;
    const wait = Math.max(delay, lastStart + LIVE_PUBLISH_GAP_MS - now(), 0);
    timer = timers.set(() => {
      timer = null;
      void send();
    }, wait);
  };

  async function send(): Promise<void> {
    if (!running || halt !== null || inFlight !== null || pending === null) return;
    // Held: the state waits for `start` after the return to writing.
    if (held()) return;
    if (!current()) {
      halt = "signedOut";
      pending = null;
      return;
    }
    // Back online, the `online` event schedules the last state again.
    if (!network.isOnline()) return;
    const text = pending;
    // Only a state that actually goes out starts a new conflict allowance.
    // An edit that returns to unsent bytes cannot renew the exhausted retry.
    if (text !== conflicted) conflicted = null;
    if (text !== exhausted) exhausted = null;
    const controller = new AbortController();
    inFlight = controller;
    lastStart = now();
    let status = 0;
    let returnedToken: string | null | undefined;
    try {
      const api = createApi({
        fetchImpl: (url, init) => {
          const headers = new Headers(init?.headers);
          if (token === null) headers.set("if-none-match", "*");
          else headers.set("if-match", `"${token}"`);
          return transport(url, { ...init, headers, signal: controller.signal });
        },
      });
      const result = await api("live.document.put", {
        params: { documentId: options.documentId },
        query: undefined,
        body: JSON.parse(text) as Input<"live.document.put">["body"],
      });
      status = result.status;
      if (result.ok) {
        const next = result.body.token;
        if (next === null || UUID.test(next)) returnedToken = next;
      }
    } catch {
      // A lost answer leaves the last accepted state uncertain.
    }
    if (inFlight !== controller) return;
    inFlight = null;
    // Stopped meanwhile: nothing is read from the answer and nothing goes out.
    if (controller.signal.aborted || !running) return;
    if (status === 200 && typeof returnedToken === "string") {
      token = returnedToken;
      accepted = text;
      if (pending === text) pending = null;
      retryMs = 0;
      conflicted = null;
      settle();
      schedule();
      return;
    }
    if (status === 409 && returnedToken !== undefined) {
      // A late or second writer moved the token, so the route may hold
      // anything: take the token and send the last state once more, but only
      // once per state; a later change is tried afresh (no loop).
      // Track sent bytes, not offers: A's answer cannot spend B's retry, and
      // an intermediate offer that never went out cannot renew it either.
      token = returnedToken;
      accepted = null;
      retryMs = 0;
      if (conflicted === text) exhausted = text;
      conflicted = text;
      settle();
      schedule();
      return;
    }
    if (status === 401 || status === 404) {
      halt = status === 401 ? "signedOut" : "notFound";
      pending = null;
      return;
    }
    if (status === 413 || status === 422) {
      // The same bytes would be refused again; a later change is tried afresh.
      refused = text;
      if (pending === text) pending = null;
      settle();
      schedule();
      return;
    }
    // No answer, or one that does not say what the route holds: the request
    // may have landed (an answer lost after the write), so a return to the
    // accepted state must still go; CAS settles what the route holds.
    accepted = null;
    settle();
    retryMs = retryMs === 0 ? LIVE_PUBLISH_RETRY_FIRST_MS : Math.min(retryMs * 2, LIVE_PUBLISH_RETRY_MAX_MS);
    schedule(retryMs);
  }

  /**
   * With nothing in flight the route holds `accepted`, so a waiting state equal
   * to it (or to bytes already refused) need not go. While a request is in
   * flight this is not known, which is why `offer` keeps every state then and
   * the answer decides here.
   */
  function settle(): void {
    if (pending !== null && (pending === accepted || pending === refused || pending === exhausted)) pending = null;
  }

  return {
    offer(document) {
      let text: string;
      try {
        text = canonicalizeJcs(document);
      } catch {
        return;
      }
      pending = text;
      // A return to the accepted state while another one is in flight must
      // still go: once that answer comes, the route holds the other state.
      if (inFlight === null) settle();
      schedule();
    },
    start() {
      if (running || halt !== null) return;
      running = true;
      unsubscribe = network.subscribe(() => {
        if (network.isOnline()) schedule();
      });
      schedule();
    },
    stop() {
      running = false;
      clearTimer();
      unsubscribe?.();
      unsubscribe = null;
      const flight = inFlight;
      inFlight = null;
      // The aborted request may still have landed, so the route may no longer
      // hold `accepted`; after a restart CAS settles what it holds.
      if (flight !== null) accepted = null;
      flight?.abort();
    },
    halted: () => halt,
  };
}
