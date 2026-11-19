/**
 * F-8 3d-2c2: the browser adapters of `EvidenceSession`, joined here so that
 * `src/components/` imports no adapter directly (Backend #711 c.6392614020,
 * B2): the open route, the browser replayer, the drain runner over the
 * evidence transport with receipts verified only under the keys of the
 * opened work, and the browser's network signal.
 *
 * Ported from Ductus 0cdb0f1 (WEB-38 2/2). The differences from the source:
 * - every request goes through `createApi` (evidence-ingest.ts), so the
 *   default transport is `browserTransport` of api.ts, and the commit route
 *   is known by the end of its path, since createApi hands over a full URL
 *   under the contract's prefix, not the Ductus path itself;
 * - imports are relative (`@/` of Ductus is not an import of the client), and
 *   the window is `globalThis.window`, as in online-status.ts, for
 *   no-direct-api.test.ts.
 */

import type { EvidenceSessionDeps } from "../components/editor/evidence-session";
import { createBrowserEditStepsV1Replayer } from "../../packages/editor-core/src/document/forensics/replay/edit-steps-v1-browser-replayer";
import type { QueuedTransaction } from "../../packages/editor-core/src/sync/journal-types";
import { createDrainRunner, type DrainJournal } from "../../packages/editor-core/src/sync/runner/drain-runner";
import { createEvidenceTransport, evidenceVerifierFor } from "../../packages/editor-core/src/sync/runner/evidence-transport";

import { browserTransport, responseMatches } from "./api";
import { createCommitProtocol, openWork, type FetchLike } from "./evidence-ingest";
import { readOnline, type OnlineSource } from "./online-status";

/** The commit route: its operation and the end of its path. */
const COMMIT_OPERATION = "evidence.commit.post";
const COMMIT_ROUTE = "/evidence/commit";

/** Whether a request createApi makes goes to the commit route; anything unreadable does not. */
function isCommitRoute(input: string): boolean {
  try {
    return new URL(input, "https://route.invalid").pathname.endsWith(COMMIT_ROUTE);
  } catch {
    return false;
  }
}

/**
 * WEB-38 (#105 review): whether a commit 409 is exactly the contract's
 * `not_accepting`, read as createApi reads an error body of a protocol route
 * (JSON content type, the declared shape for the status, nothing more). An
 * answer createApi would not read, an unknown field included, closes nothing.
 */
async function declaredNotAccepting(response: Response): Promise<boolean> {
  if (!response.headers.get("content-type")?.startsWith("application/json")) return false;
  try {
    const bytes = await response.clone().arrayBuffer();
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return responseMatches(COMMIT_OPERATION, 409, body, bytes.byteLength)
      && (body as { status?: unknown }).status === "not_accepting";
  } catch {
    return false;
  }
}

/**
 * DAN-595 (QA c.6730803432): one `Ductus-Protocol` state for the life of the
 * tab, not one per opened work. A 426 to "2" keeps the tab on "1" until a
 * reload, also for a work opened again through client-side navigation, so the
 * tab pays that 426 once.
 */
const tabCommitProtocol = createCommitProtocol();

/**
 * 3d-2c2a §4, O1 (a) (#476 c.6397490151): the commit client maps a 409
 * `not_accepting` to the same drain outcome as a 404, so this wrapper tells
 * the session apart before the response goes on, unread, to the commit
 * client. Only the commit route counts: a `not_accepting` from the open route
 * is an assignment not open yet.
 *
 * F-155: the commit route says `not_accepting` for three reasons (BACKEND
 * 4.13): a submission, a current version not acknowledged, or one not open
 * yet. So the 409 alone closes nothing: `isSubmitted` asks the server again,
 * and only its "submitted" closes the session by submission. An unknown
 * answer leaves the session as it is; nothing is ever offered for deletion on
 * a guess. The response waits for that answer, so the session knows before
 * the drain hears the outcome, as before, but never longer than
 * `confirmWithinMs` (Codex r4384309111): an open route that does not answer
 * counts as unknown, so the drain, and sign-out waiting on it, goes on.
 */
export const SUBMISSION_CONFIRM_MS = 5_000;

export function watchClosedBySubmission(
  fetchImpl: FetchLike,
  isSubmitted: () => Promise<boolean>,
  confirmWithinMs: number = SUBMISSION_CONFIRM_MS,
): {
  fetchImpl: FetchLike;
  watch: NonNullable<EvidenceSessionDeps["watchSubmission"]>;
} {
  const listeners = new Set<() => void>();
  const confirmed = async (): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), confirmWithinMs); });
    try {
      return await Promise.race([isSubmitted().then((yes) => yes === true, () => false), late]);
    } finally {
      clearTimeout(timer);
    }
  };
  const wrapped: FetchLike = async (input, init) => {
    const response = await fetchImpl(input, init);
    if (isCommitRoute(input) && response.status === 409 && await declaredNotAccepting(response)
      && await confirmed()) {
      for (const listener of [...listeners]) listener();
    }
    return response;
  };
  return {
    fetchImpl: wrapped,
    watch: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** A request this tab did not make: its sign-in is no longer the browser's. */
export class SignedOutError extends Error {
  constructor() {
    super("signed_out");
    this.name = "SignedOutError";
  }
}

/**
 * Asks `current()` right before every request (F-154, the F-093 pattern of
 * `comments.ts` and the live publisher): once it is false nothing is sent and
 * the call throws. The open route then reads `unavailable` and the drain a
 * lost answer (`transport_error`), so no row is ever refused without an
 * answer of the server.
 */
export function guardedFetch(fetchImpl: FetchLike, current: () => boolean): FetchLike {
  return (input, init) => (current() ? fetchImpl(input, init) : Promise.reject(new SignedOutError()));
}

export type BrowserEvidenceInput = {
  journal: EvidenceSessionDeps["journal"] & DrainJournal;
  documentId: string;
  assignmentId: string;
  /** Whether this tab's sign-in is still the browser's; asked before each request. */
  current: () => boolean;
  fetchImpl?: FetchLike;
  source?: OnlineSource;
};

export function browserEvidenceSessionDeps(input: BrowserEvidenceInput): EvidenceSessionDeps {
  const fetchImpl = guardedFetch(input.fetchImpl ?? browserTransport, input.current);
  const source = input.source ?? globalThis.window;
  const open = () => openWork(input.assignmentId, fetchImpl);
  // F-155: only the open route's own "submitted" closes the session by submission.
  const closed = watchClosedBySubmission(fetchImpl, async () => {
    const outcome = await open();
    return outcome.status === "opened" && outcome.work.submitted;
  });
  return {
    journal: input.journal,
    documentId: input.documentId,
    open,
    replayer: createBrowserEditStepsV1Replayer,
    createRunner: (work) => createDrainRunner<QueuedTransaction>({
      journal: input.journal,
      transport: createEvidenceTransport(closed.fetchImpl, tabCommitProtocol),
      verifyFor: evidenceVerifierFor(work),
    }),
    watchSubmission: closed.watch,
    storedProfile: (meta) => meta?.evidenceProfileId ?? null,
    network: {
      online: () => readOnline(source),
      onOnline: (listener) => {
        source.addEventListener("online", listener);
        return () => source.removeEventListener("online", listener);
      },
    },
  };
}
