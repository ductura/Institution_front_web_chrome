// WEB-V17-RUBRIC-MARK: the teacher's level marks of one work. The criteria come from the assignment's rubric
// (type imported from the form's model, not changed); the marks from teacher.work-rubric.get. Nothing here
// adds, averages or orders marks: a mark is 0, 1, 2 or none.
import type { Rubric, RubricCriterion } from "../../rubric/rubric-model";

export const NOTE_MAX = 2000;
export type Level = 0 | 1 | 2;
export type Mark = { readonly criterionId: string; readonly level: Level | null; readonly note: string | null };
export type Row = { readonly criterion: RubricCriterion | null; readonly mark: Mark };

/** Marks in the server's order, each joined to its criterion; a mark of an unknown criterion keeps `criterion: null`. */
export function joinRows(rubric: Rubric, marks: readonly Mark[]): readonly Row[] {
  const byId = new Map(rubric.map((c) => [c.id, c]));
  return marks.map((mark) => ({ criterion: byId.get(mark.criterionId) ?? null, mark }));
}

/** The mark list with one mark replaced by what the server answered; others are untouched. */
export const withMark = (marks: readonly Mark[], next: Mark): readonly Mark[] =>
  marks.map((m) => (m.criterionId === next.criterionId ? next : m));

/** The note as the contract wants it: trimmed, null when empty, null (invalid) when over the limit. */
export function noteValue(text: string): string | null | "too-long" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return trimmed.length > NOTE_MAX ? "too-long" : trimmed;
}

/** True when the shown form differs from the saved mark (so Save has something to send). */
export const isChanged = (saved: Mark, level: Level | null, noteText: string): boolean =>
  saved.level !== level || (saved.note ?? "") !== noteText.trim();
