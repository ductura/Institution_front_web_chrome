import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr.ts";
import { wordRangeHr } from "../../../../../../src/lib/i18n/length-line.ts";

import { summaryText as t } from "./messages.hr";

export type SummaryInput = {
  readonly dueAt: string;
  readonly wordMin: number | null;
  readonly wordMax: number | null;
  readonly aiPurposes: readonly string[];
  /** Absent on a server that does not send it: treated as false. */
  readonly aiPolicy?: string;
  readonly aiSummaryOnly?: boolean;
};

export type AssistantState = "available" | "summaryOnly" | "unavailable";

/**
 * ASIST-S1: whether the Assistant works in this assignment. Prohibited policy, or no purpose the
 * teacher allowed and no summary-only switch, means it is not available; nothing is guessed.
 */
export function assistantState(view: Pick<SummaryInput, "aiPolicy" | "aiPurposes" | "aiSummaryOnly">): AssistantState {
  if (view.aiPolicy === "prohibited") return "unavailable";
  if (view.aiSummaryOnly === true) return "summaryOnly";
  return view.aiPurposes.some(known) ? "available" : "unavailable";
}

const known = (key: string): key is keyof typeof t.purposes => Object.hasOwn(t.purposes, key);

const assistantLine = { available: t.assistantPilot, summaryOnly: t.assistantSummaryOnly, unavailable: t.assistantUnavailable } as const;

/**
 * P-8: the six lines of the card, in this order: deadline, length, what is allowed
 * (one line from aiPurposes), the Assistant line (ASIST-S1), what is recorded, "Potvrda nije privola". Only data
 * the notice already has; a purpose this app does not know is left out, not guessed.
 */
export function summaryLines(view: SummaryInput, time: (iso: string) => string = formatDateTimeHr): string[] {
  const range = wordRangeHr({ min: view.wordMin, max: view.wordMax });
  const names = view.aiPurposes.filter(known).map((key) => t.purposes[key]);
  return [
    t.due.replace("{time}", time(view.dueAt)),
    range === null ? t.lengthNone : t.length.replace("{range}", range),
    names.length === 0 ? t.allowedNone : t.allowed.replace("{list}", names.join(", ")),
    assistantLine[assistantState(view)],
    t.recorded,
    t.notConsent,
  ];
}
