// An in-memory server for the withdrawal flow (WEB-1903), invented data. Tests and the catalogue
// only. It keeps the rules of the plan (P-D3): a withdrawal only while `open` is true, each one
// answered with a signed receipt, the state as the single source of `withdrawable`.
import type { SignedWithdrawalReceipt, WithdrawalReceipt, WithdrawCall } from "./contract";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const ok = (body: unknown, status = 200) => ({ ok: true as const, status, body });
const fail = (status: number, code: string) => ({ ok: false as const, status, code });

/** The signed envelope the server answers with; the list keeps only the summary. */
export function envelopeOf(r: WithdrawalReceipt): SignedWithdrawalReceipt {
  return {
    payload: {
      receiptSchema: "ductus-submission-withdrawal-receipt-v1", withdrawalId: r.withdrawalId,
      submissionId: "00000000-0000-4000-8000-0000000000b1", submissionReceiptSha256: "a".repeat(64),
      evidenceDomainId: "00000000-0000-4000-8000-0000000000c1", principalId: "00000000-0000-4000-8000-0000000000d1",
      assignmentId: r.assignmentId, withdrawnAt: r.withdrawnAt, dueAt: "2026-12-20T21:00:00.000Z", signedAt: r.withdrawnAt,
    },
    payloadDigestSha256: "b".repeat(64),
    signature: { algorithm: "Ed25519", keyId: "test-key", keyVersion: "1", signatureEncoding: "raw", signatureBase64Url: r.signature },
  };
}

export function fakeWithdrawServer(opts: { open?: boolean; submitted?: boolean } = {}) {
  const state = { open: opts.open ?? true, submitted: opts.submitted ?? true };
  const receipts: WithdrawalReceipt[] = [];
  const call: WithdrawCall = async (id, input) => {
    if (id === "student.submission-withdrawal.get") {
      return ok({ withdrawable: state.open && state.submitted, receipts });
    }
    if (input.params?.assignmentId !== ASSIGNMENT) return fail(404, "not_found");
    if (!state.open || !state.submitted) return fail(409, "conflict");
    const receipt: WithdrawalReceipt = {
      withdrawalId: `00000000-0000-4000-8000-${String(receipts.length + 1).padStart(12, "0")}`,
      assignmentId: ASSIGNMENT, revision: 7 + receipts.length, withdrawnAt: "2026-12-01T10:00:00.000Z", signature: "c2lnbmVkLWluLXRlc3Q=",
    };
    receipts.push(receipt);
    state.submitted = false;
    return ok({ status: "withdrawn", receipt: envelopeOf(receipt) });
  };
  return { call, receipts, close: () => { state.open = false; }, resubmit: () => { state.submitted = true; } };
}
