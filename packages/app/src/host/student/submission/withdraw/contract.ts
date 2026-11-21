// Withdrawal of a submission, the student's side (WEB-1903; plan P-D3).
// TODO(ugovor): the routes are not in @ductura/contracts yet. These are the smallest shapes the
// plan gives: the caller passes the transport and createApi answers "client_rejected" to them, so
// the screen says "unavailable", never "nothing to withdraw". Every state is the server's answer
// (B-6): the button exists only while the server's `withdrawable` is true, and the client never
// compares a time with a deadline.
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type WithdrawCall = (
  id: "student.submission-withdrawal.get" | "student.submission-withdraw.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** The signed confirmation of one withdrawal; it is what the student downloads. */
export type WithdrawalReceipt = {
  readonly withdrawalId: string;
  readonly assignmentId: string;
  readonly revision: number;
  readonly withdrawnAt: string;
  readonly signature: string;
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
const WITHDRAWN: Schema = closed({ receipt: RECEIPT });

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
    const result = await call("student.submission-withdraw.post", { body: { assignmentId } });
    if (result.ok) {
      if (result.status !== 200 && result.status !== 201) return UNKNOWN;
      if (!matchesSchema(WITHDRAWN, result.body)) return UNKNOWN;
      const { receipt } = result.body as { receipt: WithdrawalReceipt };
      return receipt.assignmentId === assignmentId ? { kind: "povuceno", receipt } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 409) return { kind: "zakljuceno" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
