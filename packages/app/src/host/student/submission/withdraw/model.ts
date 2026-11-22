import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import { readWithdrawalState, withdrawSubmission, type WithdrawalReceipt, type WithdrawalState, type WithdrawCall, type WithdrawOutcome } from "./contract";
import { withdrawText as t } from "./messages.hr";

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
