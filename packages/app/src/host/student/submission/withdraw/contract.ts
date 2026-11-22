// Withdrawal of a submission, the student's side (WEB-1903; plan P-D3).
// WEB-2003: the operations are the server's own (SRV-2005): student.submission-withdrawal.get and
// .post, from the contract excerpt. The caller passes the transport, so a rejected call reads as
// "unavailable", never "nothing to withdraw". Every state is the server's answer (B-6): the button exists only while the server's `withdrawable` is true, and the client never
// compares a time with a deadline.
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type WithdrawCall = (
  id: "student.submission-withdrawal.get" | "student.submission-withdrawal.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** The server's signed envelope of one withdrawal (ductus-submission-withdrawal-receipt-v1). */
export type SignedWithdrawalReceipt = {
  readonly payload: {
    readonly receiptSchema: "ductus-submission-withdrawal-receipt-v1";
    readonly withdrawalId: string;
    readonly submissionId: string;
    readonly submissionReceiptSha256: string;
    readonly evidenceDomainId: string;
    readonly principalId: string;
    readonly assignmentId: string;
    readonly withdrawnAt: string;
    readonly dueAt: string;
    readonly signedAt: string;
  };
  readonly payloadDigestSha256: string;
  readonly signature: {
    readonly algorithm: "Ed25519";
    readonly keyId: string;
    readonly keyVersion: string;
    readonly signatureEncoding: "raw";
    readonly signatureBase64Url: string;
  };
};

/**
 * One withdrawal as the student sees it. The list read gives a summary with the revision; the
 * answer to the withdrawal itself gives the full signed envelope, which carries no revision
 * (`revision` is null then) and is what the student downloads when it is present.
 */
export type WithdrawalReceipt = {
  readonly withdrawalId: string;
  readonly assignmentId: string;
  readonly revision: number | null;
  readonly withdrawnAt: string;
  readonly signature: string;
  readonly envelope?: SignedWithdrawalReceipt;
};

export type WithdrawalState = {
  /** The server's decision: false after the deadline, when the teacher switched it off, or with nothing submitted. */
  readonly withdrawable: boolean;
  readonly receipts: readonly WithdrawalReceipt[];
};

export type StateRead =
  | { readonly kind: "ready"; readonly state: WithdrawalState }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

export type WithdrawOutcome =
  | { readonly kind: "povuceno"; readonly receipt: WithdrawalReceipt }
  /** 409: the withdrawal is closed (deadline passed or switched off); the state is read again. */
  | { readonly kind: "zakljuceno" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the withdrawal may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID: Schema = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const RECEIPT: Schema = closed({
  withdrawalId: UUID,
  assignmentId: UUID,
  revision: { type: "integer", minimum: 1 },
  withdrawnAt: { type: "string", format: "date-time" },
  signature: { type: "string", minLength: 1 },
});
const STATE: Schema = closed({ withdrawable: { type: "boolean" }, receipts: { type: "array", items: RECEIPT } });
const SHA: Schema = { type: "string", minLength: 1 };
const ENVELOPE: Schema = closed({
  payload: closed({
    receiptSchema: { const: "ductus-submission-withdrawal-receipt-v1" },
    withdrawalId: UUID,
    submissionId: UUID,
    submissionReceiptSha256: SHA,
    evidenceDomainId: UUID,
    principalId: UUID,
    assignmentId: UUID,
    withdrawnAt: { type: "string", format: "date-time" },
    dueAt: { type: "string", format: "date-time" },
    signedAt: { type: "string", format: "date-time" },
  }),
  payloadDigestSha256: SHA,
  signature: closed({
    algorithm: { const: "Ed25519" },
    keyId: SHA,
    keyVersion: SHA,
    signatureEncoding: { const: "raw" },
    signatureBase64Url: SHA,
  }),
});
const WITHDRAWN: Schema = closed({ status: { const: "withdrawn" }, receipt: ENVELOPE });
/** Server codes that mean the withdrawal is closed: deadline passed, switched off, nothing submitted. */
const CLOSED_CODES = new Set(["conflict", "not_allowed", "refused", "not_started"]);

export async function readWithdrawalState(call: WithdrawCall, assignmentId: string): Promise<StateRead> {
  if (!matchesSchema(UUID, assignmentId)) return UNKNOWN;
  try {
    const result = await call("student.submission-withdrawal.get", { params: { assignmentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(STATE, result.body)) return UNKNOWN;
    const state = result.body as WithdrawalState;
    const ids = state.receipts.map((r) => r.withdrawalId);
    return new Set(ids).size === ids.length && state.receipts.every((r) => r.assignmentId === assignmentId)
      ? { kind: "ready", state }
      : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

export async function withdrawSubmission(call: WithdrawCall, assignmentId: string): Promise<WithdrawOutcome> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("student.submission-withdrawal.post", { params: { assignmentId } });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(WITHDRAWN, result.body)) return UNKNOWN;
      const envelope = (result.body as { receipt: SignedWithdrawalReceipt }).receipt;
      if (envelope.payload.assignmentId !== assignmentId) return UNKNOWN;
      const { withdrawalId, withdrawnAt } = envelope.payload;
      const receipt: WithdrawalReceipt = { withdrawalId, assignmentId, revision: null, withdrawnAt, signature: envelope.signature.signatureBase64Url, envelope };
      return { kind: "povuceno", receipt };
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409 || CLOSED_CODES.has(result.code)) return { kind: "zakljuceno" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
