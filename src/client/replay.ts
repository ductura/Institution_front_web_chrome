/**
 * The browser side of the replay (DAN-537, rb 261, contract on #1836; route
 * evidence.replay.post of the contract, through createApi). The body names the document, the page
 * start and, after the first page, the head the first page reported; who asks
 * comes only from the session cookie, so the student and the teacher send the
 * same requests, get the same bytes and see the same player (PRODUCT §5 rule 5).
 *
 * A page is taken only when it is exactly a replay page that continues the
 * pages before it: the same head, the next index, no field it does not know.
 * Anything else is `unavailable`, never part of a record. When the record no
 * longer holds the pinned head (409, a submission cut it) everything read so
 * far is dropped and the reading starts again from the first page, at most
 * twice; pages of two records are never joined.
 */

import type { EvidenceChainHeadV2 } from "../../packages/editor-core/src/document/forensics/evidence-chain-v2";

import { browserTransport, createApi, type ProtocolVersion } from "./api";
import { buildReplayPlayer, type ReplayPlayer, type ReplayRecord } from "./replay-record/replay-player";
import { createBrowserReplayStepsV1, createBrowserReplayStepsV3 } from "./replay-record/replay-steps";
import type { ReplayStepReplayer } from "./replay-record/replay-timeline";

const REPLAY_PROTOCOL = "1" satisfies ProtocolVersion;
/** The transport createApi is handed: the browser's by default, a test's own. */
type Transport = typeof browserTransport;

export const REPLAY_PAGE_FORMAT = "ductus-evidence-replay-v1";
/** The route's MAX_REPLAY_PAGE_SEGMENTS: a page with more is no page of it. */
export const REPLAY_PAGE_MAX_SEGMENTS = 256;
/** Fresh readings after a 409 before the record counts as unavailable. */
export const REPLAY_RESTARTS = 2;

export type ReplayPage = {
  segmentCount: number;
  head: EvidenceChainHeadV2 | null;
  from: number;
  next: number | null;
  startDocument: string | null;
  segments: string[];
  resumeDocuments: Record<string, string>;
};

const HASH = /^[0-9a-f]{64}$/;
const KEYS = ["replayFormat", "segmentCount", "head", "from", "next", "startDocument", "segments", "resumeDocuments"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function exactly(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

const whole = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min;

function head(value: unknown): EvidenceChainHeadV2 | null {
  if (!exactly(value, ["segmentHash", "segmentCount"])) return null;
  const { segmentHash, segmentCount } = value;
  if (typeof segmentHash !== "string" || !HASH.test(segmentHash) || !whole(segmentCount, 1)) return null;
  return { segmentHash, segmentCount };
}

function texts(value: unknown): Record<string, string> | null {
  if (!isObject(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (!HASH.test(key) || typeof text !== "string") return null;
    out[key] = text;
  }
  return out;
}

/**
 * The page when `value` is exactly the replay page that starts at `from` and,
 * for every page after the first, ends at the `pin` the first one reported;
 * otherwise null.
 */
export function parseReplayPage(value: unknown, from: number, pin: EvidenceChainHeadV2 | null): ReplayPage | null {
  if (!exactly(value, KEYS) || value.replayFormat !== REPLAY_PAGE_FORMAT) return null;
  const { segmentCount: count, next, startDocument, segments } = value;
  if (!whole(count, 0) || value.from !== from) return null;

  const pageHead = value.head === null ? null : head(value.head);
  if (value.head !== null && pageHead === null) return null;
  // No head exactly when the record is empty, and the head's count is the page's.
  if ((pageHead === null) !== (count === 0) || (pageHead !== null && pageHead.segmentCount !== count)) return null;
  if (pin !== null && (pageHead === null || pageHead.segmentHash !== pin.segmentHash || pageHead.segmentCount !== pin.segmentCount)) {
    return null;
  }

  if (!Array.isArray(segments) || !segments.every((segment) => typeof segment === "string")) return null;
  if (segments.length > REPLAY_PAGE_MAX_SEGMENTS) return null;
  const resumeDocuments = texts(value.resumeDocuments);
  if (resumeDocuments === null) return null;

  if (count === 0) {
    // The empty record is one first page with nothing on it.
    if (from !== 0 || segments.length !== 0 || next !== null || startDocument !== null || Object.keys(resumeDocuments).length !== 0) {
      return null;
    }
  } else {
    const end = from + segments.length;
    if (segments.length === 0 || end > count || next !== (end < count ? end : null)) return null;
    // The document before the first change comes on the first page and only there.
    if (from === 0 ? typeof startDocument !== "string" : startDocument !== null) return null;
  }
  return {
    segmentCount: count,
    head: pageHead,
    from,
    next: next as number | null,
    startDocument: startDocument as string | null,
    segments: segments as string[],
    resumeDocuments,
  };
}

export type ReplayRecordOutcome =
  | { kind: "ok"; record: ReplayRecord }
  | { kind: "signedOut" | "notFound" | "unavailable" };

type PageRead = { kind: "page"; page: ReplayPage } | { kind: "changed" } | { kind: "signedOut" | "notFound" | "unavailable" };

async function readPage(
  documentId: string,
  from: number,
  pin: EvidenceChainHeadV2 | null,
  fetcher: Transport,
): Promise<PageRead> {
  // The page is read only from the bytes of a 200, exactly as the route wrote them.
  let bytes: Uint8Array | null = null;
  let status = 0;
  const transport: Transport = async (input, init) => {
    const response = await fetcher(input, { ...init, credentials: "same-origin", cache: "no-store" });
    status = response.status;
    bytes = response.status === 200 ? new Uint8Array(await response.clone().arrayBuffer()) : null;
    return response;
  };
  try {
    await createApi({ fetchImpl: transport, protocol: REPLAY_PROTOCOL })("evidence.replay.post", {
      params: undefined,
      query: undefined,
      body: pin === null ? { documentId, from: 0 } : { documentId, from, head: pin },
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (status === 401) return { kind: "signedOut" };
  if (status === 404) return { kind: "notFound" };
  if (status === 409) return { kind: "changed" };
  if (status !== 200 || bytes === null) return { kind: "unavailable" };
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { kind: "unavailable" };
  }
  const page = parseReplayPage(value, from, pin);
  return page === null ? { kind: "unavailable" } : { kind: "page", page };
}

/**
 * Reads every page of the record of `documentId`, pinned to the head of the
 * first. `current()` is asked before every request: once the session has
 * ended in this browser nothing more is sent (F-093).
 */
export async function fetchReplayRecord(
  documentId: string,
  current: () => boolean = () => true,
  fetcher: Transport = browserTransport,
): Promise<ReplayRecordOutcome> {
  for (let reading = 0; reading <= REPLAY_RESTARTS; reading++) {
    // A fresh reading keeps nothing of the one before it.
    let pin: EvidenceChainHeadV2 | null = null;
    let startDocument: string | null = null;
    const segments: string[] = [];
    const resumeDocuments: Record<string, string> = {};
    let from: number | null = 0;
    let changed = false;
    while (from !== null) {
      if (!current()) return { kind: "signedOut" };
      const read = await readPage(documentId, from, pin, fetcher);
      if (read.kind === "changed") {
        changed = true;
        break;
      }
      if (read.kind !== "page") return { kind: read.kind };
      const { page } = read;
      if (pin === null) {
        pin = page.head;
        startDocument = page.startDocument;
      }
      for (const [hash, text] of Object.entries(page.resumeDocuments)) {
        // The same hash names one text; two texts for it are no record.
        if (Object.hasOwn(resumeDocuments, hash) && resumeDocuments[hash] !== text) return { kind: "unavailable" };
        resumeDocuments[hash] = text;
      }
      segments.push(...page.segments);
      from = page.next;
    }
    if (!changed) return { kind: "ok", record: { startDocument, segments, head: pin, resumeDocuments } };
  }
  return { kind: "unavailable" };
}

/** The step formats the replay reads, each with the replayer of its document schema (INT-23). */
const STEP_REPLAYERS: Readonly<Record<string, () => ReplayStepReplayer<unknown>>> = {
  "ductus-edit-steps-v1": createBrowserReplayStepsV1 as () => ReplayStepReplayer<unknown>,
  "ductus-edit-steps-v3": createBrowserReplayStepsV3 as () => ReplayStepReplayer<unknown>,
};

/**
 * The replayer of the work's schema, named by the step format of its first
 * segment; `null` for a format the replay does not read or a first segment
 * with no format. Nothing is trusted here: the timeline still checks the
 * chain, that every segment has this same format and that the start document
 * is one of this schema, and fails closed otherwise. An empty record is read
 * as before, with the v1 replayer.
 */
export function replayStepsFor(record: Pick<ReplayRecord, "segments">): ReplayStepReplayer<unknown> | null {
  const first = record.segments[0];
  if (first === undefined) return STEP_REPLAYERS["ductus-edit-steps-v1"]!();
  let format: unknown;
  try {
    const segment: unknown = JSON.parse(first);
    const context = isObject(segment) ? segment.captureContext : undefined;
    format = isObject(context) ? context.transactionFormat : undefined;
  } catch {
    return null;
  }
  return typeof format === "string" && Object.hasOwn(STEP_REPLAYERS, format) ? STEP_REPLAYERS[format]!() : null;
}

export type ReplayOutcome =
  | { kind: "ok"; player: Extract<ReplayPlayer, { ok: true }> }
  | { kind: "signedOut" | "notFound" | "unavailable" };

/**
 * The one entry both views call: the record read and verified, then replayed.
 * There is no input about who looks; a record that fails any check is
 * `unavailable`, never shown in part.
 */
export async function loadReplay(
  documentId: string,
  current: () => boolean = () => true,
  fetcher?: Transport,
): Promise<ReplayOutcome> {
  const read = await fetchReplayRecord(documentId, current, fetcher);
  if (read.kind !== "ok") return read;
  const steps = replayStepsFor(read.record);
  if (steps === null) return { kind: "unavailable" };
  const player = await buildReplayPlayer(read.record, steps);
  return player.ok ? { kind: "ok", player } : { kind: "unavailable" };
}
