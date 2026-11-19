/**
 * The browser side of the student's submission (WEB-22, S: PO-17; B-6, B-8).
 *
 * submission.submit.post goes through createApi under `ductus-protocol: 1`
 * and sends exactly the document and the revision the student sees, never a
 * time, a hash or text. Every answer maps onto one closed table:
 *
 * - 200 is `predano` only when the receipt is exactly the signed v2 shape of
 *   the contract (schema-check) and names the document and revision sent;
 * - 409 `blocked` is `odbijeno` with its reason, `record_mismatch` aside,
 *   which is `nedovrseno`;
 * - 408, 503, a broken connection and any shape outside the contract are
 *   `nepoznato`: the work may be submitted, so the page never says it is not;
 * - 409 `already_requested` reads the state of the submission: `stanje` only
 *   when it is `ceka` or `potvrdeno` for the revision the 409 names (and, for a
 *   receipt, the document sent); `none` or any other revision or document is
 *   `nepoznato`, so the page never says the work is not submitted;
 * - 401 is `session-expired`, the shell's flow for an ended session;
 * - the declared refusals the inventory does not map (`stale_revision`,
 *   `not_acknowledged`, `not_open`, 404, 413, 426 and the refusals of the
 *   request itself) are `greska` with their code; the text is WEB-26's (P-10).
 *
 * The browser does not check the Ed25519 signature (P-4), so nothing here
 * says it is verified.
 *
 * TODO(ugovor): student.submission.get, student.assignment-requirements.get
 * and student.submission-notes.{get,post} come with @ductura/contracts 3.1.0
 * (SRV-19, SRV-25). Until then their shapes are local (below), the caller
 * passes the transport (`LocalCall`) and only tests call them, with invented
 * answers. On 3.1.0 they move to createApi and these schemas are dropped for
 * the contract's.
 */

import { createApi, errorBody, RESPONSES, type ApiOptions, type ApiResult } from "./api";
import { matchesSchema, type Schema } from "./schema-check";

type SubmitSuccess = Extract<ApiResult<"submission.submit.post">, { ok: true }>;
export type SubmissionReceipt = SubmitSuccess["body"]["receipt"];

export type BlockedReason = "segment_unsigned" | "record_discontinuous" | "no_evidence";
export type SubmitError =
  | "stale_revision" | "not_acknowledged" | "not_open" | "not_found" | "too_large" | "upgrade_required"
  | "forbidden" | "bad_request" | "unsupported_media_type" | "invalid" | "client_rejected";

/** The state of a submission as student.submission.get gives it (SRV-19). */
export type SubmissionState =
  | { readonly kind: "none" }
  /** Recorded, the receipt not bound yet (503 signing). Never "predano". */
  | { readonly kind: "ceka"; readonly revision: number; readonly requestedAt: string }
  | { readonly kind: "potvrdeno"; readonly receipt: SubmissionReceipt };

export type Read<T> =
  | T
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  | { readonly kind: "nepoznato" };

export type SubmissionRead = Read<SubmissionState>;

export type SubmitOutcome =
  | { readonly kind: "predano"; readonly receipt: SubmissionReceipt }
  | { readonly kind: "odbijeno"; readonly reason: BlockedReason }
  | { readonly kind: "nedovrseno" }
  | { readonly kind: "nepoznato" }
  | { readonly kind: "greska"; readonly code: SubmitError; readonly currentRevision?: number }
  | { readonly kind: "session-expired" }
  /** 409 already_requested: the server holds `revision`, and the read agrees. */
  | { readonly kind: "stanje"; readonly revision: number; readonly state: Exclude<SubmissionState, { kind: "none" }> };

export type SubmitInput = { readonly assignmentId: string; readonly documentId: string; readonly revision: number };

/** TODO(ugovor): the transport of a route that is not in the published contract yet. */
export type LocalCall = (
  id: "student.submission.get" | "student.assignment-requirements.get" | "student.submission-notes.get" | "student.submission-notes.post",
  input: { readonly params: { readonly assignmentId: string }; readonly body?: { readonly assignmentId: string; readonly text: string } },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function schemaAt(id: string, status: string): Schema {
  const schema = RESPONSES.get(id)?.[status]?.content?.["application/json"]?.schema;
  if (schema === undefined) throw new Error(`contract: no ${status} schema for ${id}`);
  return schema;
}

const SUBMITTED = schemaAt("submission.submit.post", "200");
// The one receipt shape (SignedSubmissionReceiptV2), read from the contract, never written here.
const RECEIPT = ((SUBMITTED as { properties?: Record<string, Schema> }).properties?.receipt ?? false);
const TIME = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z$" } as const;
const REVISION = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER } as const;
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

// TODO(ugovor): local shapes until 3.1.0 (SRV-19).
const STATE: Schema = {
  oneOf: [
    closed({ state: { const: "none" } }),
    closed({ state: { const: "ceka" }, revision: REVISION, requestedAt: TIME }),
    closed({ state: { const: "potvrdeno" }, receipt: RECEIPT }),
  ],
};
const COUNT = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const REQUIREMENTS: Schema = closed({ wordRange: { anyOf: [{ type: "null" }, closed({ min: COUNT, max: COUNT })] } });
export const NOTE_MAX = 600;
const NOTE_TEXT = { type: "string", minLength: 1, maxLength: NOTE_MAX } as const;
const NOTE: Schema = closed({ id: { type: "string", minLength: 1 }, text: NOTE_TEXT, createdAt: TIME });
const NOTES: Schema = closed({ notes: { type: "array", items: NOTE } });
const NOTE_ADDED: Schema = closed({ note: NOTE });

const BLOCKED: ReadonlySet<string> = new Set(["segment_unsigned", "record_discontinuous", "no_evidence"]);
const REFUSALS: Readonly<Record<string, SubmitError>> = {
  stale_revision: "stale_revision", not_acknowledged: "not_acknowledged", not_open: "not_open",
  not_found: "not_found", too_large: "too_large", upgrade_required: "upgrade_required", forbidden: "forbidden",
  bad_request: "bad_request", unsupported_media_type: "unsupported_media_type", invalid: "invalid",
  client_rejected: "client_rejected",
};
const UNKNOWN = { kind: "nepoznato" } as const;
const EXPIRED = { kind: "session-expired" } as const;

/** True when the receipt is exactly the contract's shape and names this assignment, document and revision. */
function receiptFor(receipt: unknown, match: { assignmentId: string; documentId?: string; revision?: number }): receipt is SubmissionReceipt {
  if (!matchesSchema(RECEIPT, receipt)) return false;
  const p = (receipt as SubmissionReceipt).payload;
  return p.assignmentId === match.assignmentId.toLowerCase()
    && (match.documentId === undefined || p.documentId === match.documentId)
    && (match.revision === undefined || p.revision === match.revision);
}

/**
 * One answer of submission.submit.post as an outcome, without the state read
 * of already_requested (`submitWork` does it). `kept` is the error body
 * createApi kept (errorBody), only when it is the contract's for its status.
 */
export function submitOutcomeFrom(
  result: { readonly ok: boolean; readonly status: number; readonly code?: string; readonly body?: unknown },
  kept: unknown,
  sent: SubmitInput,
): SubmitOutcome | { readonly kind: "already_requested"; readonly revision: number } {
  if (result.ok) {
    if (result.status !== 200 || !matchesSchema(SUBMITTED, result.body)) return UNKNOWN;
    const { receipt } = result.body as { receipt: unknown };
    return receiptFor(receipt, sent) ? { kind: "predano", receipt } : UNKNOWN;
  }
  if (result.status === 401) return EXPIRED;
  if (result.status === 409) {
    if (!isObject(kept)) return UNKNOWN;
    if (kept.status === "blocked") {
      if (kept.reason === "record_mismatch") return { kind: "nedovrseno" };
      return BLOCKED.has(String(kept.reason)) ? { kind: "odbijeno", reason: kept.reason as BlockedReason } : UNKNOWN;
    }
    if (kept.status === "already_requested" && typeof kept.revision === "number") {
      return { kind: "already_requested", revision: kept.revision };
    }
    if (kept.status === "stale_revision" && typeof kept.currentRevision === "number") {
      return { kind: "greska", code: "stale_revision", currentRevision: kept.currentRevision };
    }
  }
  const code = result.code === undefined || !Object.hasOwn(REFUSALS, result.code) ? undefined : REFUSALS[result.code];
  // 408 timeout, 503 unavailable, 429, 500, "unexpected": the work may have been submitted.
  return code === undefined ? UNKNOWN : { kind: "greska", code };
}

export type SubmitDeps = {
  /** False once the session has ended in this browser: nothing is sent (D-118). */
  readonly current?: () => boolean;
  /** TODO(ugovor): student.submission.get; without it already_requested is `nepoznato`. */
  readonly local?: LocalCall;
  readonly api?: ApiOptions;
};

/** Sends one submission of what the student sees. Never throws. */
export async function submitWork(input: SubmitInput, deps: SubmitDeps = {}): Promise<SubmitOutcome> {
  if (deps.current !== undefined && !deps.current()) return EXPIRED;
  let outcome: ReturnType<typeof submitOutcomeFrom>;
  try {
    const api = createApi({ ...deps.api, protocol: "1" });
    const result = await api("submission.submit.post", {
      params: undefined, query: undefined, body: { documentId: input.documentId, revision: input.revision },
    });
    outcome = submitOutcomeFrom(result, errorBody(result), input);
  } catch {
    return UNKNOWN;
  }
  if (outcome.kind !== "already_requested") return outcome;
  if (deps.local === undefined) return UNKNOWN;
  const state = await readSubmissionState(deps.local, input.assignmentId);
  if (state.kind === "session-expired") return EXPIRED;
  const agrees = (state.kind === "ceka" && state.revision === outcome.revision)
    || (state.kind === "potvrdeno" && receiptFor(state.receipt, { ...input, revision: outcome.revision }));
  return agrees ? { kind: "stanje", revision: outcome.revision, state } : UNKNOWN;
}

async function readLocal<T>(
  local: LocalCall, call: Parameters<LocalCall>, schema: Schema, ok: readonly number[], take: (body: unknown) => Read<T>,
  invalid = false,
): Promise<Read<T>> {
  try {
    const result = await local(...call);
    if (result.ok) return ok.includes(result.status) && matchesSchema(schema, result.body) ? take(result.body) : UNKNOWN;
    if (result.status === 401) return EXPIRED;
    // A missing, another student's and a malformed id are the same 404 (SRV-22).
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    return invalid && result.status === 422 ? { kind: "greska", code: "invalid" } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** student.submission.get (TODO(ugovor)): a receipt for another assignment is `nepoznato`. */
export function readSubmissionState(local: LocalCall, assignmentId: string): Promise<SubmissionRead> {
  return readLocal<SubmissionState>(local, ["student.submission.get", { params: { assignmentId } }], STATE, [200], (body) => {
    const b = body as { state: string; revision?: number; requestedAt?: string; receipt?: unknown };
    if (b.state === "none") return { kind: "none" };
    if (b.state === "ceka") return { kind: "ceka", revision: b.revision as number, requestedAt: b.requestedAt as string };
    return receiptFor(b.receipt, { assignmentId }) ? { kind: "potvrdeno", receipt: b.receipt } : UNKNOWN;
  });
}

export type WordRange = { readonly min: number; readonly max: number } | null;

/** student.assignment-requirements.get (TODO(ugovor), PO-12): min above max is `nepoznato`. */
export function readRequirements(local: LocalCall, assignmentId: string): Promise<Read<{ kind: "ready"; wordRange: WordRange }>> {
  const call: Parameters<LocalCall> = ["student.assignment-requirements.get", { params: { assignmentId } }];
  return readLocal(local, call, REQUIREMENTS, [200], (body) => {
    const { wordRange } = body as { wordRange: WordRange };
    return wordRange !== null && wordRange.min > wordRange.max ? UNKNOWN : { kind: "ready", wordRange };
  });
}

export type SubmissionNote = { readonly id: string; readonly text: string; readonly createdAt: string };

/** student.submission-notes.get (TODO(ugovor), C-5, PD-4). */
export function readNotes(local: LocalCall, assignmentId: string): Promise<Read<{ kind: "ready"; notes: SubmissionNote[] }>> {
  const call: Parameters<LocalCall> = ["student.submission-notes.get", { params: { assignmentId } }];
  return readLocal(local, call, NOTES, [200], (body) => ({ kind: "ready", notes: (body as { notes: SubmissionNote[] }).notes }));
}

/**
 * student.submission-notes.post (TODO(ugovor)): append only. Text that is
 * blank or over 600 characters is not sent (`greska` invalid), the same
 * outcome as the server's 422.
 */
export async function addNote(
  local: LocalCall, assignmentId: string, text: string,
): Promise<Read<{ kind: "added"; note: SubmissionNote }>> {
  if (!matchesSchema(NOTE_TEXT, text) || text.trim() === "") return { kind: "greska", code: "invalid" };
  const call: Parameters<LocalCall> = ["student.submission-notes.post", { params: { assignmentId }, body: { assignmentId, text } }];
  return readLocal(local, call, NOTE_ADDED, [200, 201], (body) => ({ kind: "added", note: (body as { note: SubmissionNote }).note }), true);
}
