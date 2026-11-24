import { parseWordRange, type AssignmentDraft } from "@/components/teacher/assignment-create";
import { zagrebInstant } from "@/lib/i18n/zagreb";

import { assignmentFormHr } from "./messages.hr";

const e = assignmentFormHr.errors;

export type FormField = "title" | "instructions" | "opensAt" | "dueAt" | "wordMax" | "groups";
export type FormErrors = Partial<Record<FormField, string>>;

/** All checks of the one form (zs-1 and zs-2) in the order the fields appear. */
export function checkForm(draft: AssignmentDraft): FormErrors {
  const errors: FormErrors = {};
  const title = draft.title.trim();
  if (!title || Array.from(title).length > 160) errors.title = e.title;
  if (Array.from(draft.instructions).length > 20_000) errors.instructions = e.instructions;
  const opensAt = zagrebInstant(draft.opensAt);
  const dueAt = zagrebInstant(draft.dueAt);
  if (!opensAt) errors.opensAt = e.opensAt;
  if (!dueAt) errors.dueAt = e.dueAt;
  else if (opensAt && dueAt <= opensAt) errors.dueAt = e.dueBeforeOpen;
  if (!parseWordRange(draft.wordMin, draft.wordMax)) errors.wordMax = e.words;
  return errors;
}

/** The text of the summary box `#wz-err`: every error, in field order. */
export function errorSummary(errors: FormErrors): string {
  const order: FormField[] = ["title", "instructions", "opensAt", "dueAt", "wordMax", "groups"];
  return order.flatMap((field) => errors[field] ?? []).join(" ");
}

/**
 * The create body with the practice flag (WEB-1901, PIL-D1-POLJE): the contract field `isPractice`, sent only when
 * ticked, as a boolean, never a grade or score field. An unticked box leaves the body as it was.
 */
export function withPractice<T extends object>(body: T, draft: { practice?: boolean }): T & { isPractice?: true } {
  return draft.practice === true ? { ...body, isPractice: true } : body;
}

/** Reads the flag back from `institution.assignment.get`: only an explicit `true` is a practice assignment. */
export function practiceOf(current: { isPractice?: boolean }): boolean {
  return current.isPractice === true;
}
