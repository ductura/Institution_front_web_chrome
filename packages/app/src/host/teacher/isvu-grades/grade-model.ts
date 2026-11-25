// WEB-V22-ISVU-MODEL: pure model of the grade entry form (no network, no storage).
// Never sorts, averages or groups by grade; the list is always alphabetical by surname (hr).
import { isvuGradesMessages as m } from "./messages.hr";

export type Grade = 1 | 2 | 3 | 4 | 5;
export type GradeInput = { readonly ok: true; readonly grade: Grade | null } | { readonly ok: false; readonly error: string };

/** Empty or whitespace = not sent (null). Only the integers 1..5 are accepted; 0, 6, 2.5, "2,5", "1e0" and text are rejected. */
export const parseGradeInput = (raw: string | null | undefined): GradeInput => {
  const text = (raw ?? "").trim();
  if (text === "") return { ok: true, grade: null };
  if (!/^[1-5]$/.test(text)) return { ok: false, error: m.invalidGrade };
  return { ok: true, grade: Number(text) as Grade };
};

export const gradeName = (grade: Grade): string => m.gradeNames[grade] ?? "";

export interface GradeStudent { readonly studentId: string; readonly givenName: string; readonly familyName: string }

/** Alphabetical by surname then given name, hr collation, ties by id; independent of any grade. */
export const alphabeticalStudents = <T extends GradeStudent>(students: readonly T[]): T[] =>
  [...students].sort((a, b) =>
    a.familyName.localeCompare(b.familyName, "hr") || a.givenName.localeCompare(b.givenName, "hr") || a.studentId.localeCompare(b.studentId));

export interface GradeBatchRow { readonly studentId: string; readonly grade: Grade }
export type GradeBatch = { readonly ok: true; readonly rows: readonly GradeBatchRow[] } | { readonly ok: false; readonly invalid: readonly string[] };

/** Builds the request rows from raw entries: blanks are dropped, any invalid entry blocks the whole batch. */
export const buildBatch = (entries: Readonly<Record<string, string>>): GradeBatch => {
  const rows: GradeBatchRow[] = [];
  const invalid: string[] = [];
  for (const [studentId, raw] of Object.entries(entries)) {
    const r = parseGradeInput(raw);
    if (!r.ok) invalid.push(studentId);
    else if (r.grade !== null) rows.push({ studentId, grade: r.grade });
  }
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, rows };
};
