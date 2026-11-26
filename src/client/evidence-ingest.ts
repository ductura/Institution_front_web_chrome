/**
 * The browser side of the evidence routes (F-8 step 3c, DAN-37; routes: B-8,
 * docs/BACKEND.md 4.13), ported from Ductus 0cdb0f1 (WEB-38). `openWork` asks
 * `evidence.open.post` for the student's work, `commitEvidence` sends one
 * segment and the document after it to `evidence.commit.post`, and
 * `createReceiptVerifier` is the trusted-key verifier the drain runner needs
 * before SYNCED.
 *
 * - Both routes go through `createApi` of api.ts with `ductus-protocol`
 *   (ApiOptions.protocol), never through a request of their own: an answer
 *   that is not exactly the contract's shape for its status is never read.
 * - Bytes go out exactly as they were hashed: the caller hands over the JCS
 *   bytes of the segment and of the snapshot, and they travel as standard
 *   base64 (4.13 t. 2). Nothing here re-serialises a document.
 * - Every answer of the commit route maps onto the drain's one vocabulary
 *   (`DrainOutcome`) through one closed table (4.13 t. 4); a status, code or
 *   shape outside it is never read as success.
 * - SYNCED needs a receipt that verifies under a receipt key from the open
 *   route, never under a key from the response that carries the receipt, and
 *   whose `segmentHash` is the hash of the segment this client sent (F-3).
 * - DAN-595: the commit goes out under `ductus-protocol: 2` (4.13 t. 1). A
 *   202 `pending_signature` is a stored commit without a receipt yet: the
 *   row stays held and the same key is sent again, never SYNCED. A server
 *   that does not take "2" answers 426 before reading the body, so the same
 *   request is sent once more under "1" and that tab stays on "1".
 */

import { MAX_DOCUMENT_SNAPSHOT_BYTES } from "../../packages/editor-core/src/document/document/snapshot";
import { exceedsEvidenceSegmentLimit } from "../../packages/editor-core/src/document/forensics/evidence-chain-v2";
import { isReceiptClientTransactionId } from "../../packages/editor-core/src/document/forensics/evidence-receipt";
import { isEvidenceProfileIdV2 } from "../../packages/editor-core/src/document/forensics/evidence-segment-v2";
import {
  verifySignedEvidenceReceiptV2,
  type EvidenceDomainKey,
} from "../../packages/editor-core/src/document/forensics/evidence-receipt-verifier";
import { parseCommitOutcome } from "../../packages/editor-core/src/serverSync/contract";
import type { DrainOutcome, SignedCommitReceiptVerifier } from "../../packages/editor-core/src/sync/drain";

import { createApi, errorBody, RESPONSES, type ApiOptions, type ProtocolVersion } from "./api";
import { matchesSchema, type Schema } from "./schema-check";

/**
 * A transport as Ductus callers write it (the drain's evidence transport, the
 * session's guards): the URL as text and an init. `createApi` sends through
 * it; without one, through the browser's own.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Ductus `commit-envelope`: "1" signs at once, "2" may answer 202 `pending_signature`. */
const DUCTUS_PROTOCOL_VERSION = "1" satisfies ProtocolVersion;
const DUCTUS_ASYNC_COMMIT_PROTOCOL = "2" satisfies ProtocolVersion;

/** The student's work as the open route reports it (4.13 t. 6). */
export type OpenedWork = {
  documentId: string;
  evidenceProfileId: string;
  currentRevision: number;
  documentHash: string;
  headSegmentHash: string | null;
  lastSequenceTo: number;
  /** Exact JCS bytes of the snapshot of `currentRevision`. */
  document: Uint8Array;
  /** The one evidence domain every receipt key belongs to. */
  evidenceDomainId: string;
  receiptKeys: readonly EvidenceDomainKey[];
  /** True exactly when the student's submission of this work is recorded (DAN-289 O2). */
  submitted: boolean;
  /** The server-confirmed schema version of the work's revision zero; absent when the server did not state it. */
  schemaVersion?: 1 | 2 | 3;
  /** The server's hash of the work's revision zero; a v3 work at a later revision is verified with it (PIL-K-SPREMANJE-V3). */
  revisionZeroHash?: string;
  /** ED-22 (NF2-P26): the minute of the work's last signed save on the server; absent when there is none yet or the server did not state it. */
  lastSignedAt?: string;
};

export type OpenOutcome =
  | { status: "opened"; work: OpenedWork }
  /** Not signed in, no such work for this person, notice not acknowledged (F-7). */
  | { status: "unauthenticated" | "not_found" | "not_accepting" }
  /** The app is older than the server's protocol: reload it. */
  | { status: "upgrade_required" }
  /** No answer, or one this client cannot vouch for; `offline` when no answer came at all (ED-01b). */
  | { status: "unavailable"; offline?: true };

export type EvidenceCommitInput = {
  documentId: string;
  clientTransactionId: string;
  baseRevision: number;
  /** Exact JCS bytes of one segment v2. */
  segment: Uint8Array;
  /** Exact JCS bytes of the document after the segment's last event. */
  document: Uint8Array;
};

const SHA256_HEX = /^[0-9a-f]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/**
 * INT-12 (N05): the shape of the open answer is the contract's own (the 200 of
 * `evidence.open.post` in RESPONSES), never a copy written here; openedWorkFrom
 * only adds the rules the contract cannot state. contract-parsers.test.ts
 * holds it to every 2xx vector.
 */
const OPENED: Schema | undefined = RESPONSES.get("evidence.open.post")?.["200"]?.content?.["application/json"]?.schema;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** An ISO instant that reads back as itself, so 2026-02-30 is not taken for 2 March. */
function isCalendarInstant(text: string): boolean {
  const epochMs = Date.parse(text);
  return !Number.isNaN(epochMs) && new Date(epochMs).toISOString() === text;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Standard base64 with padding that encodes back to the same text; else null. */
export function decodeBase64(text: unknown): Uint8Array | null {
  if (typeof text !== "string" || !BASE64.test(text)) return null;
  try {
    const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
    return encodeBase64(bytes) === text ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * The `ductus-protocol` one tab speaks to the commit route. It starts at "2"
 * and turns to "1" only on a 426 `upgrade_required` answered to "2"; nothing
 * else changes it, and it never goes back to "2" within the tab.
 *
 * DAN-595 (QA c.6731112408): until the server has answered "2" once, only one
 * request of the tab goes out under "2" (`probe`); every other send waits for
 * that answer and then goes out under the version it settled, so a tab pays at
 * most one 426 even when two works send at the same time. `agreed` is set by
 * an answer to "2" that the route gives only after it has read the header
 * (`settlesProtocol`); a request that got no answer, a 5xx, or a 403/405 from
 * the origin check settles nothing and the next send probes again.
 */
export type CommitProtocol = {
  version: ProtocolVersion;
  agreed: boolean;
  probe: Promise<void> | null;
};

export function createCommitProtocol(): CommitProtocol {
  return { version: DUCTUS_ASYNC_COMMIT_PROTOCOL, agreed: false, probe: null };
}

/**
 * The route checks method and origin (403, 405) before `ductus-protocol` and
 * answers 426 at that check. Status 0 is an answer that could not be read.
 */
function settlesProtocol(httpStatus: number): boolean {
  return httpStatus >= 100 && httpStatus < 500 && httpStatus !== 403 && httpStatus !== 405 && httpStatus !== 426;
}

/**
 * Waits while another request of the tab probes "2". Returns the release of
 * this request's own probe when it is the one to probe, else null.
 */
async function enterProtocol(protocol: CommitProtocol): Promise<(() => void) | null> {
  while (protocol.version === DUCTUS_ASYNC_COMMIT_PROTOCOL && !protocol.agreed) {
    if (protocol.probe === null) {
      let open: () => void = () => {};
      const probe = new Promise<void>((resolve) => { open = resolve; });
      protocol.probe = probe;
      return () => {
        if (protocol.probe === probe) protocol.probe = null;
        open();
      };
    }
    await protocol.probe;
  }
  return null;
}

/**
 * One answer of an evidence route as this module reads it. `http` is the
 * status, 0 for an answer whose JSON could not be read; `body` is the success
 * body, or the error body the contract declares for that status (createApi
 * keeps it under ApiOptions.protocol), else undefined. "lost": the request
 * failed or its answer never came. "not_sent": the input broke the contract,
 * so createApi sent nothing.
 */
type Answer = { readonly http: number; readonly body: unknown } | "lost" | "not_sent";

async function send(
  id: "evidence.open.post" | "evidence.commit.post",
  body: Record<string, unknown>,
  fetchImpl: FetchLike | undefined,
  protocol: ProtocolVersion,
): Promise<Answer> {
  const options: ApiOptions = fetchImpl === undefined ? { protocol } : {
    // createApi hands its transport a URL object.
    fetchImpl: (url, init) => fetchImpl(url instanceof Request ? url.url : String(url), init ?? {}),
    protocol,
  };
  try {
    const api = createApi(options);
    const result = id === "evidence.open.post"
      ? await api(id, { params: undefined, query: undefined, body: body as { assignmentId: string } })
      : await api(id, {
        params: undefined, query: undefined,
        body: body as { documentId: string; clientTransactionId: string; baseRevision: number; segments: string[]; document: string },
      });
    if (!result.ok && result.status === 0) return result.code === "client_rejected" ? "not_sent" : { http: 0, body: undefined };
    return { http: result.status, body: result.ok ? result.body : errorBody(result) };
  } catch {
    return "lost";
  }
}

/**
 * The receipt keys of exactly one evidence domain, or null. The verifier
 * judges each key itself; here only the domain is read, so that a list
 * mixing domains cannot choose which domain a receipt is held to.
 */
function receiptDomainOf(keys: unknown): { domain: string; keys: EvidenceDomainKey[] } | null {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const domains = new Set<unknown>();
  for (const key of keys) {
    if (!isObject(key) || key.purpose !== "receipt") return null;
    domains.add(key.evidenceDomainId);
  }
  const [domain] = [...domains];
  return domains.size === 1 && typeof domain === "string" && domain !== ""
    ? { domain, keys: keys as EvidenceDomainKey[] }
    : null;
}

/**
 * The open answer in its closed shape, or null. The shape (every field, its
 * type, the optional `schemaVersion` and `revisionZeroHash`) is the contract's;
 * on top of it: base64 that encodes back to the same text, a snapshot within
 * the editor's limit, a profile the journal and segment v2 take, and receipt
 * keys of exactly one evidence domain.
 */
export function openedWorkFrom(value: unknown): OpenedWork | null {
  if (OPENED === undefined || !isObject(value) || !matchesSchema(OPENED, value)) return null;
  const {
    documentId, evidenceProfileId, currentRevision, documentHash, headSegmentHash, lastSequenceTo, submitted,
  } = value as {
    documentId: string; evidenceProfileId: string; currentRevision: number; documentHash: string;
    headSegmentHash: string | null; lastSequenceTo: number; submitted: boolean;
  };
  const document = decodeBase64(value.document);
  const keys = receiptDomainOf(value.receiptKeys);
  if (
    // The same rule as the journal and segment v2, so a profile they would refuse is refused here (#733).
    !isEvidenceProfileIdV2(evidenceProfileId) ||
    document === null || document.byteLength > MAX_DOCUMENT_SNAPSHOT_BYTES || keys === null
  ) {
    return null;
  }
  const schemaVersion = value.schemaVersion;
  const revisionZeroHash = value.revisionZeroHash;
  const lastSignedAt = value.lastSignedAt;
  // The contract states the minute's shape; a minute that is no calendar minute is not shown.
  if (typeof lastSignedAt === "string" && !isCalendarInstant(lastSignedAt)) return null;
  return {
    documentId, evidenceProfileId, currentRevision, documentHash, headSegmentHash, lastSequenceTo,
    document, evidenceDomainId: keys.domain, receiptKeys: keys.keys, submitted,
    ...(schemaVersion === 1 || schemaVersion === 2 || schemaVersion === 3 ? { schemaVersion } : {}),
    ...(typeof revisionZeroHash === "string" ? { revisionZeroHash } : {}),
    ...(typeof lastSignedAt === "string" ? { lastSignedAt } : {}),
  };
}

/**
 * Opens the student's work for one assignment, under protocol "1". Only
 * `start: true`, sent from the student's own "Započni rad", makes a work that
 * does not exist yet (DAN-331, F-137); without it the server answers 409
 * `not_started`, which is `unavailable` here.
 */
export async function openWork(
  assignmentId: string, fetchImpl?: FetchLike, options: { start?: boolean } = {},
): Promise<OpenOutcome> {
  const answer = await send(
    "evidence.open.post", options.start === true ? { assignmentId, start: true } : { assignmentId },
    fetchImpl, DUCTUS_PROTOCOL_VERSION,
  );
  if (answer === "lost" || (typeof answer !== "string" && answer.http === 0)) return { status: "unavailable", offline: true };
  if (typeof answer === "string") return { status: "unavailable" };
  const status = isObject(answer.body) ? answer.body.status : undefined;
  if (answer.http === 200) {
    const work = openedWorkFrom(answer.body);
    return work ? { status: "opened", work } : { status: "unavailable" };
  }
  if (answer.http === 401 && status === "unauthenticated") return { status };
  if (answer.http === 404 && status === "not_found") return { status };
  if (answer.http === 409 && status === "not_accepting") return { status };
  if (answer.http === 426) return { status: "upgrade_required" };
  return { status: "unavailable" };
}

/** HTTP code each refusal of 4.13 t. 4 comes with; a mismatch is not that refusal. */
const REFUSALS: Readonly<Record<string, readonly [number, DrainOutcome]>> = {
  txid_reused: [409, { status: "txid_reused" }],
  invalid: [422, { status: "invalid_document" }],
  document_mismatch: [422, { status: "invalid_document" }],
  too_large: [413, { status: "too_large" }],
  not_found: [404, { status: "not_found" }],
  // The notice was not acknowledged, or the package takes no more evidence:
  // repeating changes nothing, and the key was not stored.
  not_accepting: [409, { status: "not_found" }],
  unauthenticated: [401, { status: "unauthenticated" }],
};

const CONFLICTS: ReadonlySet<unknown> = new Set(["stale_base", "chain_conflict", "not_continuous"]);

/**
 * One answer of the commit route as a drain outcome (4.13 t. 4), for the
 * protocol it was sent under. A 200 carries only a signed receipt and a 202
 * only `pending_signature`, and a 202 is read only under "2"; a receipt in
 * the other code is `invalid`, so a pending answer never reaches the
 * verifier as signed and a signed one is never read as pending.
 */
export function commitOutcomeFrom(
  httpStatus: number, body: unknown, protocol: ProtocolVersion = DUCTUS_PROTOCOL_VERSION,
): DrainOutcome {
  const status = isObject(body) ? body.status : undefined;
  const accepted = status === "committed" || status === "duplicate";
  if (accepted && (httpStatus === 200 || (httpStatus === 202 && protocol === DUCTUS_ASYNC_COMMIT_PROTOCOL))) {
    const outcome = parseCommitOutcome(body);
    if (outcome.status !== "committed" && outcome.status !== "duplicate") return outcome;
    const pending = outcome.receipt.status === "pending_signature";
    return pending === (httpStatus === 202) ? outcome : { status: "invalid" };
  }
  // Our own commit cannot be overwritten: any of the three asks the author to reconcile.
  if (httpStatus === 409 && CONFLICTS.has(status)) {
    const currentRevision = (body as Record<string, unknown>).currentRevision;
    return isCount(currentRevision) ? { status: "stale_base", currentRevision } : { status: "invalid" };
  }
  const refusal = typeof status === "string" && Object.hasOwn(REFUSALS, status) ? REFUSALS[status] : undefined;
  if (refusal && refusal[0] === httpStatus) return refusal[1];
  // The server, a proxy or the network did not finish: the same key is sent again.
  if (httpStatus >= 500) return { status: "transport_error" };
  // The body did not arrive in time, so the route read no key and stored nothing.
  if (httpStatus === 408 && status === "timeout") return { status: "transport_error" };
  // `upgrade_required` and anything unreadable: the commit may have landed,
  // so the row stays held and nothing is retried by itself.
  return { status: "invalid" };
}

/**
 * Sends one segment and the snapshot after it. Never throws: a request that
 * could not be made or whose answer was lost is `transport_error`; an input
 * the contract refuses is never sent and is `invalid`.
 *
 * `protocol` is the tab's own (one per tab, `evidence-session-deps.ts`). A 426 `upgrade_required`
 * to "2" is answered before the route reads the body, so nothing was stored:
 * the identical body, same key included, goes once more under "1", and
 * "1" stays for the tab. A 426 to "1" is `invalid` as before.
 */
export async function commitEvidence(
  input: EvidenceCommitInput, fetchImpl?: FetchLike, protocol: CommitProtocol = createCommitProtocol(),
): Promise<DrainOutcome> {
  if (!isReceiptClientTransactionId(input.clientTransactionId)) return { status: "invalid_client_transaction_id" };
  if (exceedsEvidenceSegmentLimit(input.segment.byteLength) || input.document.byteLength > MAX_DOCUMENT_SNAPSHOT_BYTES) {
    return { status: "too_large" };
  }
  const payload = {
    documentId: input.documentId,
    clientTransactionId: input.clientTransactionId,
    baseRevision: input.baseRevision,
    segments: [encodeBase64(input.segment)],
    document: encodeBase64(input.document),
  };
  const release = await enterProtocol(protocol);
  let sentUnder = protocol.version;
  let answer: Answer;
  let upgradeRequired = false;
  try {
    answer = await send("evidence.commit.post", payload, fetchImpl, sentUnder);
    if (typeof answer !== "string") {
      upgradeRequired = answer.http === 426 && sentUnder === DUCTUS_ASYNC_COMMIT_PROTOCOL &&
        isObject(answer.body) && answer.body.status === "upgrade_required";
      if (upgradeRequired) protocol.version = DUCTUS_PROTOCOL_VERSION;
      else if (sentUnder === DUCTUS_ASYNC_COMMIT_PROTOCOL && settlesProtocol(answer.http)) protocol.agreed = true;
    }
  } finally {
    release?.();
  }
  if (upgradeRequired) {
    sentUnder = DUCTUS_PROTOCOL_VERSION;
    answer = await send("evidence.commit.post", payload, fetchImpl, sentUnder);
  }
  if (answer === "lost") return { status: "transport_error" };
  if (answer === "not_sent") return { status: "invalid" };
  if (answer.body === undefined && answer.http >= 500) return { status: "transport_error" };
  return commitOutcomeFrom(answer.http, answer.body, sentUnder);
}

/**
 * The verifier for the drain runner. A receipt passes only when it verifies
 * under a receipt key of the work's domain (from the open route), names the
 * expected document, transaction and revision, and carries the hash of the
 * segment this client sent under that transaction id (`sentSegmentHash`).
 * Anything else, a runtime that cannot verify included, is false.
 */
export function createReceiptVerifier(
  work: Pick<OpenedWork, "evidenceDomainId" | "receiptKeys">,
  sentSegmentHash: (clientTransactionId: string) => string | null,
): SignedCommitReceiptVerifier {
  return async (signedReceipt, expected) => {
    let segmentHash: string | null;
    try {
      segmentHash = sentSegmentHash(expected.clientTransactionId);
    } catch {
      return false;
    }
    if (typeof segmentHash !== "string" || !SHA256_HEX.test(segmentHash)) return false;
    const verified = await verifySignedEvidenceReceiptV2(
      signedReceipt,
      {
        documentId: expected.documentId,
        clientTransactionId: expected.clientTransactionId,
        revision: expected.revision,
        evidenceDomainId: work.evidenceDomainId,
      },
      work.receiptKeys,
    );
    return verified.ok && verified.payload.segmentHash === segmentHash;
  };
}
