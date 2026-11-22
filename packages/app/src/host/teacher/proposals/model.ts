import type { ActionOutcome, Decision, ListOutcome, Suggestion } from "@/components/editor/suggestions";

import { teacherProposalsMessages as t } from "./messages.hr";

export type ProposalsRead = { kind: "loading" } | ListOutcome;

/** Newest first would hide the numbering; the prototype lists them in the order they were made. */
export function orderedProposals(list: readonly Suggestion[]): Suggestion[] {
  return [...list].sort((a, b) => a.number - b.number);
}

/** Status line of the panel when no card can be shown. */
export function proposalsStatus(read: ProposalsRead, count: number): string | null {
  if (read.kind === "loading") return t.loading;
  if (read.kind === "ok") return count === 0 ? t.empty : null;
  return t[read.kind];
}

/** The toast is shown only after the server confirmed (WEB-2164), and only for a withdrawal. */
export const withdrawToast = (decision: Decision, outcome: ActionOutcome, text: string): string | null =>
  decision === "withdraw" && outcome === "ok" ? text : null;

/** A teacher only withdraws; accepted ones carry the permanent label. */
export const isAccepted = (s: Pick<Suggestion, "state">): boolean => s.state === "accepted";
