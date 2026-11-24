import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import { atOf } from "../steps/time";
import { readWithdrawalState, withdrawSubmission, type WithdrawalReceipt, type WithdrawalState, type WithdrawCall, type WithdrawOutcome } from "./contract";
import { withdrawText as t } from "./messages.hr";

/** E-7a (NF-3 PR-1, R-55): the receipt's address fragment that opens the confirmation of a withdrawal. */
export const WITHDRAW_HASH = "povuci";

/** Whether the confirmation opens on arrival: asked for by the address, and the server says it can be withdrawn. */
export function opensOnArrival(hash: string, state: WithdrawalState): boolean {
  return hash === `#${WITHDRAW_HASH}` && canWithdraw(state);
}

export type Note = { readonly tone: "status" | "alert"; readonly text: string };
/** What the page says after an action, and whether the state is read again. */
export type Followup = { readonly note: Note; readonly refresh: boolean; /** The signed confirmation of a recorded withdrawal, kept even when the state cannot be read again. */ readonly receipt?: WithdrawalReceipt };

/** The button exists only on the server's word; nothing here compares a time with a deadline. */
export function canWithdraw(state: WithdrawalState): boolean {
  return state.withdrawable === true;
}

export function withdrawNote(outcome: WithdrawOutcome): Followup | null {
  switch (outcome.kind) {
    case "povuceno": return { note: { tone: "status", text: t.withdrawn }, refresh: true, receipt: outcome.receipt };
    case "zakljuceno": return { note: { tone: "alert", text: t.closed }, refresh: true };
    case "greska": return { note: { tone: "alert", text: outcome.code === "not_found" ? t.notFound : t.invalid }, refresh: outcome.code === "not_found" };
    case "nepoznato": return { note: { tone: "alert", text: t.unknown }, refresh: false };
    default: return null;
  }
}

/** One withdrawal, start to end; null after the session ended (the caller goes to sign-in). */
export async function withdraw(call: WithdrawCall, assignmentId: string): Promise<Followup | null> {
  return withdrawNote(await withdrawSubmission(call, assignmentId));
}

export { readWithdrawalState };

/** What the page knows beside the withdrawal state: the history's switch, the deadline, whether the newest event is a withdrawal. */
export type WithdrawContext = {
  /** student.submission-history.get `withdrawalAllowed`; null while it is not known. */
  readonly allowed: boolean | null;
  /** The later of the deadline and its extension; null when it is not known. */
  readonly deadline: string | null;
  readonly withdrawn: boolean;
  readonly now: number;
};

export type WithdrawView =
  | { readonly kind: "open"; readonly lead: string; readonly explainDue: string | null }
  | { readonly kind: "withdrawn"; readonly next: string }
  | { readonly kind: "closed"; readonly reason: string };

const passed = (deadline: string | null, now: number) => deadline !== null && Date.parse(deadline) <= now;

/**
 * NF-3 PR-13 (E-11b, E-11e). The button still follows the server's `withdrawable` alone; the
 * deadline only words the reason and what comes next. Only reasons the client knows are named
 * (PO-38): switched off by the history's `withdrawalAllowed`, or the deadline passed; any other
 * stays the general sentence, never a guess.
 */
export function withdrawView(state: WithdrawalState, ctx: WithdrawContext): WithdrawView {
  const due = ctx.deadline === null ? null : atOf(ctx.deadline);
  if (canWithdraw(state)) {
    return due === null
      ? { kind: "open", lead: t.lead, explainDue: null }
      : { kind: "open", lead: t.leadDue.replace("{due}", due), explainDue: t.explainDue.replace("{due}", due) };
  }
  if (ctx.withdrawn) {
    if (due === null) return { kind: "withdrawn", next: t.withdrawnNextNoDue };
    return { kind: "withdrawn", next: (passed(ctx.deadline, ctx.now) ? t.withdrawnLate : t.withdrawnNext).replace("{due}", due) };
  }
  if (ctx.allowed === false) return { kind: "closed", reason: t.closedNotAllowed };
  if (due !== null && passed(ctx.deadline, ctx.now)) return { kind: "closed", reason: t.closedDeadline.replace("{due}", due) };
  return { kind: "closed", reason: t.closed };
}

export function receiptLine(receipt: WithdrawalReceipt): string {
  const date = formatDateTimeHr(receipt.withdrawnAt);
  return receipt.revision === null ? t.receiptLineNoRevision.replace("{date}", date) : t.receiptLine.replace("{revision}", String(receipt.revision)).replace("{date}", date);
}

/** The downloadable confirmation: exactly the signed fields the server gave, as JSON, so it can be checked later. */
export function receiptFile(receipt: WithdrawalReceipt): { readonly filename: string; readonly type: string; readonly content: string } {
  const { withdrawalId, assignmentId, revision, withdrawnAt, signature, envelope } = receipt;
  const tag = revision === null ? "" : `-r${revision}`;
  return {
    filename: `potvrda-povlacenja-${assignmentId.slice(0, 8)}${tag}-${withdrawalId.slice(0, 8)}.json`,
    type: "application/json",
    content: `${JSON.stringify(envelope ?? { withdrawalId, assignmentId, revision, withdrawnAt, signature }, null, 2)}\n`,
  };
}
