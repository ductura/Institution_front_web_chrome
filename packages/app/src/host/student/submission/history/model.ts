// NF-3 PR-15 (E-11c): the rows of "Moje predaje", newest first. A plain module, tested without rendering.
import { atOf } from "../steps/time";
import type { SignedWithdrawalReceipt } from "../withdraw/contract";
import type { HistoryEvent } from "./contract";
import { historyText as t } from "./messages.hr";

export type HistoryRow = {
  readonly key: string;
  readonly attempt: number;
  /** "Predaja 2 · 20. 12. 2026. u 23:05" (+ " · nakon roka"). */
  readonly line: string;
  readonly state:
    | { readonly kind: "current" }
    | { readonly kind: "earlier" }
    | { readonly kind: "withdrawn"; readonly line: string; readonly receipt: SignedWithdrawalReceipt | null };
};

const byTime = (a: HistoryEvent, b: HistoryEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

/**
 * One row per submission. A submission with a withdrawal of the same id is withdrawn; the newest
 * submission without one is the one in force; any other is an earlier one. Nothing is guessed:
 * the rows are the server's events only.
 */
export function historyRows(events: readonly HistoryEvent[]): readonly HistoryRow[] {
  const sorted = [...events].sort(byTime);
  const withdrawals = new Map<string, Extract<HistoryEvent, { kind: "withdrawal" }>>();
  for (const e of sorted) if (e.kind === "withdrawal") withdrawals.set(e.submissionId, e);
  const submissions = sorted.filter((e): e is Extract<HistoryEvent, { kind: "submission" }> => e.kind === "submission");
  const lastStanding = [...submissions].reverse().find((s) => !withdrawals.has(s.submissionId));
  return submissions.reverse().map((s) => {
    const withdrawal = withdrawals.get(s.submissionId);
    const line = t.attempt.replace("{n}", String(s.attempt)).replace("{at}", atOf(s.at)) + (s.afterDeadline ? t.afterDeadline : "");
    const state: HistoryRow["state"] = withdrawal !== undefined
      ? { kind: "withdrawn", line: t.withdrawn.replace("{at}", atOf(withdrawal.at)), receipt: withdrawal.receipt }
      : s === lastStanding ? { kind: "current" } : { kind: "earlier" };
    return { key: s.id, attempt: s.attempt, line, state };
  });
}

/** Whether the newest event is a withdrawal: the work is open again (E-11e after a reload). */
export function lastIsWithdrawal(events: readonly HistoryEvent[]): boolean {
  const sorted = [...events].sort(byTime);
  return sorted.at(-1)?.kind === "withdrawal";
}
