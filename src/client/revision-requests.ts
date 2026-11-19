/**
 * The browser side of the revision request route (DAN-314, docs/backend/
 * suradnja.md 4.14), ported from Ductus 0cdb0f1. Every read and write is
 * collaboration.revision-requests.post of the contract, through createApi
 * of api.ts, which sends exactly the JCS form of the input; the client never
 * names an author, a role or a state, the database takes them from the
 * session. A `list` body that is not exactly the documented shape is treated
 * as unavailable as a whole, never shown in part.
 *
 * Concurrency: a response carries the request's row_seq exactly as `list`
 * returned it. A stale counter is answered 409 with the current state; that
 * is shown to the student and never retried with a newer counter, since the
 * request may have been reopened with another instruction meanwhile.
 */

import { isTextAnchorInput, type TextAnchor } from "../../packages/editor-core/src/document/collaboration";
import {
  isExpectedSeq, isRangeHash, isRequestId, isRevisionKind, isRevisionNumber, isRevisionText, REVISION_TEXT_MAX,
  type RevisionKind,
} from "../../packages/editor-core/src/document/collaboration/revision-input";

import { createApi, type ApiOptions, type ApiResult, type Input } from "./api";

export type RevisionState = "open" | "responded" | "accepted" | "reopened" | "withdrawn";
export type RevisionClosing = "accepted" | "reopened" | "withdrawn";

export type RevisionResponse = {
  readonly kind: RevisionKind;
  readonly explanation: string;
  readonly revision: number;
  readonly isOwn: boolean;
  /** Start of the 5-minute window (P-03) the response was given in. */
  readonly window: string;
};

export type RevisionClosed = {
  readonly as: RevisionClosing;
  readonly isOwn: boolean;
  readonly window: string;
  /** The revision the teacher accepted; null unless `as` is accepted. */
  readonly acceptedRevision: number | null;
};

export type RevisionVersion = {
  readonly version: number;
  readonly instruction: string;
  readonly requestedRevision: number;
  readonly openedIsOwn: boolean;
  readonly openedWindow: string;
  readonly response: RevisionResponse | null;
  readonly closed: RevisionClosed | null;
};

export type RevisionRequest = {
  readonly id: string;
  /** 1, 2, 3… in the order the requests were opened. */
  readonly number: number;
  readonly state: RevisionState;
  /** The counter a transition must carry back unchanged. */
  readonly rowSeq: number;
  readonly anchor: TextAnchor;
  /** Every version, oldest first; the last one is current. */
  readonly versions: readonly RevisionVersion[];
};

export type RevisionListOutcome =
  | { kind: "ok"; requests: RevisionRequest[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };

export type RespondInput = {
  readonly requestId: string;
  readonly expectedSeq: number;
  readonly kind: RevisionKind;
  readonly explanation: string;
  readonly responseRevision: number;
};

export type RespondOutcome =
  | { kind: "ok" | "signedOut" | "forbidden" | "invalid" | "unavailable" }
  /** `state` is the request's state now, or null when the route did not say. */
  | { kind: "conflict"; state: RevisionState | null };

const STATES: ReadonlySet<string> = new Set(["open", "responded", "accepted", "reopened", "withdrawn"]);
const CLOSINGS: ReadonlySet<string> = new Set(["accepted", "reopened", "withdrawn"]);
const VERSION_MAX = 1000;
const ROW_KEYS = [
  "accepted_range_hash", "accepted_revision", "anchor", "closed_as", "closed_is_own", "closed_window", "instruction",
  "opened_is_own", "opened_window", "request_id", "request_row_seq", "request_state", "request_version",
  "requested_revision", "response_explanation", "response_is_own", "response_kind", "response_revision",
  "response_window", "version",
].sort();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isTime = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isVersion = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= VERSION_MAX;
/** Stored text: the database already holds it to its CHECK; only the shape is read here. */
const isStoredText = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const length = [...value].length;
  return length >= 1 && length <= REVISION_TEXT_MAX;
};

function responseOf(row: Record<string, unknown>): RevisionResponse | null | undefined {
  const { response_kind: kind, response_explanation: explanation, response_revision: revision } = row;
  // No local or later key named window: no-direct-api.test.ts reads that as a global alias.
  const { response_is_own: isOwn, response_window: at } = row;
  if ([kind, explanation, revision, isOwn, at].every((v) => v === null)) return null;
  if (!isRevisionKind(kind) || !isStoredText(explanation) || !isRevisionNumber(revision)
    || typeof isOwn !== "boolean" || !isTime(at)) return undefined;
  return { window: at, kind, explanation, revision, isOwn };
}

function closedOf(row: Record<string, unknown>): RevisionClosed | null | undefined {
  const { closed_as: as, closed_is_own: isOwn, closed_window: at } = row;
  const { accepted_revision: acceptedRevision, accepted_range_hash: rangeHash } = row;
  if ([as, isOwn, at, acceptedRevision, rangeHash].every((v) => v === null)) return null;
  if (typeof as !== "string" || !CLOSINGS.has(as) || typeof isOwn !== "boolean" || !isTime(at)) return undefined;
  if (as === "accepted") {
    if (!isRevisionNumber(acceptedRevision) || (rangeHash !== null && !isRangeHash(rangeHash))) return undefined;
  } else if (acceptedRevision !== null || rangeHash !== null) {
    return undefined;
  }
  return { window: at, as: as as RevisionClosing, isOwn, acceptedRevision: as === "accepted" ? acceptedRevision as number : null };
}

/** Does the last version agree with the request's state (suradnja.md 4.14 transitions)? */
function lastAgrees(state: RevisionState, version: number, last: RevisionVersion): boolean {
  switch (state) {
    case "open": return version === 1 && last.response === null && last.closed === null;
    case "reopened": return version >= 2 && last.response === null && last.closed === null;
    case "responded": return last.response !== null && last.closed === null;
    case "accepted": return last.response !== null && last.closed?.as === "accepted";
    case "withdrawn": return last.closed?.as === "withdrawn";
  }
}

type Building = {
  id: string; state: RevisionState; rowSeq: number; version: number; anchor: TextAnchor; versions: RevisionVersion[];
};

/**
 * Requests from the body of `list`, whose rows come ordered by request and
 * version (one row per version). Null for any row out of shape or out of
 * order, or any request whose versions disagree with its state.
 */
export function requestsFromList(value: unknown): RevisionRequest[] | null {
  if (!isObject(value) || !Array.isArray(value.requests)) return null;
  const requests: Building[] = [];
  for (const row of value.requests as unknown[]) {
    if (!isObject(row)) return null;
    const keys = Object.keys(row).sort();
    if (keys.length !== ROW_KEYS.length || keys.some((key, i) => key !== ROW_KEYS[i])) return null;
    const { request_id: id, request_state: state, request_version: head, request_row_seq: rowSeq } = row;
    const { version, instruction, requested_revision: requestedRevision } = row;
    const { opened_is_own: openedIsOwn, opened_window: openedWindow, anchor } = row;
    if (!isRequestId(id) || typeof state !== "string" || !STATES.has(state) || !isVersion(head)
      || !isExpectedSeq(rowSeq) || !isVersion(version) || version > head || !isStoredText(instruction)
      || !isRevisionNumber(requestedRevision) || typeof openedIsOwn !== "boolean" || !isTime(openedWindow)) {
      return null;
    }
    const response = responseOf(row);
    const closed = closedOf(row);
    if (response === undefined || closed === undefined) return null;
    const entry: RevisionVersion = {
      version, instruction, requestedRevision, openedIsOwn, openedWindow, response, closed,
    };
    const last = requests.at(-1);
    if (version === 1) {
      if (!isTextAnchorInput(anchor) || requests.some((r) => r.id === id)) return null;
      // The request before must be complete before another one starts.
      if (last && last.versions.length !== last.version) return null;
      requests.push({ id, state: state as RevisionState, rowSeq, version: head, anchor, versions: [entry] });
    } else if (anchor === null && last?.id === id && last.state === state && last.rowSeq === rowSeq
      && last.version === head && version === last.versions.length + 1) {
      last.versions.push(entry);
    } else {
      return null;
    }
  }
  for (const request of requests) {
    if (request.versions.length !== request.version) return null;
    const earlier = request.versions.slice(0, -1);
    // A version before the last was closed by reopening, or was answered,
    // accepted and then reopened: accept is allowed only in the responded state.
    const closedRight = (v: RevisionVersion) =>
      v.closed?.as === "reopened" || (v.closed?.as === "accepted" && v.response !== null);
    if (!earlier.every(closedRight)) return null;
    if (!lastAgrees(request.state, request.version, request.versions.at(-1)!)) return null;
  }
  return requests.map(({ id, state, rowSeq, anchor, versions }, index) => ({
    id, number: index + 1, state, rowSeq, anchor, versions,
  }));
}

type RevisionResult = ApiResult<"collaboration.revision-requests.post">;

/** One call of the route; null when no answer came (offline, aborted). */
async function post(
  action: "list" | "respond", input: Record<string, unknown>, options: ApiOptions,
): Promise<RevisionResult | null> {
  try {
    const call = { params: { action }, query: undefined, body: input } as unknown as Input<"collaboration.revision-requests.post">;
    return await createApi(options)("collaboration.revision-requests.post", call);
  } catch {
    return null;
  }
}

/** `current` is asked right before the request; false once the session has ended (F-093). */
export async function listRevisionRequests(
  documentId: string, current: () => boolean = () => true, options: ApiOptions = {},
): Promise<RevisionListOutcome> {
  if (!current()) return { kind: "signedOut" };
  const result = await post("list", { documentId }, options);
  if (result?.status === 401) return { kind: "signedOut" };
  if (result?.status === 403) return { kind: "forbidden" };
  if (!result?.ok || result.status !== 200) return { kind: "unavailable" };
  const requests = requestsFromList(result.body);
  return requests ? { kind: "ok", requests } : { kind: "unavailable" };
}

/**
 * The student's answer to the current version: done, or declined with a
 * reason. Input the route would refuse is refused here without a request.
 */
export async function respondRevisionRequest(
  input: RespondInput, current: () => boolean = () => true, options: ApiOptions = {},
): Promise<RespondOutcome> {
  const explanation = input.explanation.normalize("NFC");
  if (!isRequestId(input.requestId) || !isExpectedSeq(input.expectedSeq) || !isRevisionKind(input.kind)
    || !isRevisionText(explanation) || !isRevisionNumber(input.responseRevision)) {
    return { kind: "invalid" };
  }
  if (!current()) return { kind: "signedOut" };
  const result = await post("respond", {
    requestId: input.requestId, expectedSeq: input.expectedSeq, kind: input.kind, explanation,
    responseRevision: input.responseRevision,
  }, options);
  if (result === null) return { kind: "unavailable" };
  // A 409 with {outcome: "conflict", state} is an answer of the contract (ok);
  // a 409 problem body (not_allowed) is an error and names no state.
  if (result.status === 409) {
    const body: unknown = result.ok ? result.body : null;
    const state = isObject(body) && typeof body.state === "string" && STATES.has(body.state)
      ? body.state as RevisionState : null;
    return { kind: "conflict", state };
  }
  if (result.ok) return result.status === 200 ? { kind: "ok" } : { kind: "unavailable" };
  if (result.code === "client_rejected") return { kind: "invalid" };
  switch (result.status) {
    case 401: return { kind: "signedOut" };
    case 403: return { kind: "forbidden" };
    case 422: return { kind: "invalid" };
    default: return { kind: "unavailable" };
  }
}
