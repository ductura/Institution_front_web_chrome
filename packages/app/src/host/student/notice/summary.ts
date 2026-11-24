import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr.ts";
import { wordRangeHr } from "../../../../../../src/lib/i18n/length-line.ts";

import { summaryText as t } from "./messages.hr";

export type SummaryInput = {
  readonly dueAt: string;
  readonly wordMin: number | null;
  readonly wordMax: number | null;
  readonly aiPurposes: readonly string[];
};

const known = (key: string): key is keyof typeof t.purposes => Object.hasOwn(t.purposes, key);

/**
 * P-8: the five lines of the card, in this order: deadline, length, what is allowed
 * (one line from aiPurposes), what is recorded, "Potvrda nije privola". Only data
 * the notice already has; a purpose this app does not know is left out, not guessed.
 */
export function summaryLines(view: SummaryInput, time: (iso: string) => string = formatDateTimeHr): string[] {
  const range = wordRangeHr({ min: view.wordMin, max: view.wordMax });
  const names = view.aiPurposes.filter(known).map((key) => t.purposes[key]);
  return [
    t.due.replace("{time}", time(view.dueAt)),
    range === null ? t.lengthNone : t.length.replace("{range}", range),
    names.length === 0 ? t.allowedNone : t.allowed.replace("{list}", names.join(", ")),
    t.recorded,
    t.notConsent,
  ];
}
