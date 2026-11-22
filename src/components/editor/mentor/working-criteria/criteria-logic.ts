import {
  NOTE_MAX, type Assessment, type CriterionInput, type CriterionWrite, type WorkingCriterion,
} from "@/client/teacher-working-criteria";

import { workingCriteriaHr as t } from "./messages.hr";

/** The criterion's text, from its id (the server's label is only a message key). */
export const criterionTitle = (criterion: WorkingCriterion): string => t.criteria[criterion.id];

/** How many criteria carry an assessment: the "X od 6" of the heading. */
export const doneCount = (criteria: readonly WorkingCriterion[]): number =>
  criteria.filter((c) => c.assessment !== null).length;

export const headingText = (criteria: readonly WorkingCriterion[]): string =>
  t.title.replace("{done}", String(doneCount(criteria))).replace("{total}", String(criteria.length));

/** A click on the pressed assessment clears it (the prototype's m3Rub); the note stays. */
export function assessmentChange(criterion: WorkingCriterion, picked: Assessment): CriterionInput {
  return { assessment: criterion.assessment === picked ? null : picked, note: criterion.note };
}

/** The note as sent: trimmed, none when blank; null when over-long (the caller does not send). */
export function noteChange(criterion: WorkingCriterion, text: string): CriterionInput | null {
  const trimmed = text.trim();
  if (trimmed.length > NOTE_MAX) return null;
  return { assessment: criterion.assessment, note: trimmed === "" ? null : trimmed };
}

/** The list with the saved criterion in its place; the order of the six never changes. */
export const withSaved = (criteria: readonly WorkingCriterion[], saved: WorkingCriterion): WorkingCriterion[] =>
  criteria.map((c) => (c.id === saved.id ? saved : c));

/** What the card says after a write that did not save. A success is shown only from the server's answer (B-6). */
export function failureText(outcome: Exclude<CriterionWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.errors.signedOut;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.errors.notFound : t.errors.invalid;
  return t.errors.unknown;
}

export type Row = { readonly busy: boolean; readonly error: string | null; readonly editing: boolean; readonly draft: string };
export const IDLE_ROW: Row = { busy: false, error: null, editing: false, draft: "" };

/**
 * The state after one write. Saved: the server's criterion replaces the old
 * one and the row takes `done`. Anything else: the list is untouched and the
 * row keeps its form as typed (`editing`, `draft`) with the reason, so the
 * teacher can send it again.
 */
export function afterWrite(
  criteria: readonly WorkingCriterion[], row: Row, outcome: CriterionWrite, done: Partial<Row>,
): { criteria: readonly WorkingCriterion[]; row: Row } {
  if (outcome.kind === "saved") {
    return { criteria: withSaved(criteria, outcome.criterion), row: { ...row, busy: false, error: null, ...done } };
  }
  return { criteria, row: { ...row, busy: false, error: failureText(outcome) } };
}
