// An in-memory server for the withdrawal flow (WEB-1903), invented data. Tests and the catalogue
// only. It keeps the rules of the plan (P-D3): a withdrawal only while `open` is true, each one
// answered with a signed receipt, the state as the single source of `withdrawable`.
import type { WithdrawalReceipt, WithdrawCall } from "./contract";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const ok = (body: unknown, status = 200) => ({ ok: true as const, status, body });
const fail = (status: number, code: string) => ({ ok: false as const, status, code });

export function fakeWithdrawServer(opts: { open?: boolean; submitted?: boolean } = {}) {
  const state = { open: opts.open ?? true, submitted: opts.submitted ?? true };
  const receipts: WithdrawalReceipt[] = [];
  const call: WithdrawCall = async (id, input) => {
    if (id === "student.submission-withdrawal.get") {
      return ok({ withdrawable: state.open && state.submitted, receipts });
    }
    const body = input.body as { assignmentId?: string } | undefined;
    if (body?.assignmentId !== ASSIGNMENT) return fail(404, "not_found");
    if (!state.open || !state.submitted) return fail(409, "conflict");
    const receipt: WithdrawalReceipt = {
      withdrawalId: `00000000-0000-4000-8000-${String(receipts.length + 1).padStart(12, "0")}`,
      assignmentId: ASSIGNMENT, revision: 7 + receipts.length, withdrawnAt: "2026-12-01T10:00:00.000Z", signature: "c2lnbmVkLWluLXRlc3Q=",
    };
    receipts.push(receipt);
    state.submitted = false;
    return ok({ receipt }, 201);
  };
  return { call, receipts, close: () => { state.open = false; }, resubmit: () => { state.submitted = true; } };
}
