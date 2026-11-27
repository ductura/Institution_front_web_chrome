import type { MyAssignment, MyCourse } from "../read/assignments";
import type { WorkState } from "../read/works";
import { deadlineTagOf, extensionText, nearTag, practiceOf, submittedLine, type DeadlineTag, type ExtensionNote, type Submitted } from "../courses/model";
import { cleanCode } from "../enrol/code";
import { homeText as t } from "./messages.hr";

/** The row kinds of the prototype's `kind(t, s)`, in the order of its checks. */
export type RowKind = "predano" | "obavijest" | "rad" | "zadatak";

export type TaskRow = {
  readonly id: string;
  readonly title: string;
  readonly course: string;
  readonly kind: RowKind;
  /** Deadline as the assignment gives it: the extended one replaces the original. */
  readonly dueAt: string;
  readonly extended: boolean;
  /** The assignment's own deadline, before any extension the teacher gave this student. */
  readonly originalDueAt: string;
  /** The workType label, or the generic "Zadatak". */
  readonly typeLabel: string;
  /** P-D1: the server said `isPractice: true`; the row then carries the "Probni" badge. */
  readonly practice: boolean;
  /** NF-1 P-6: when it was submitted and whether after the deadline; absent until (and unless) the read answers. */
  readonly submitted?: Submitted | null;
  /** NF-1 P-7: the history of the extension behind `dueAt`; absent until (and unless) the read answers. */
  readonly extension?: ExtensionNote | null;
};

/** The extra reads of the home, by assignment id. */
export type Extras = {
  readonly submitted: ReadonlyMap<string, Submitted>;
  readonly extensions: ReadonlyMap<string, ExtensionNote>;
} | null | undefined;

/** The state of one work: the read's, and `null` where the work-state read did not answer. */
export type States = ReadonlyMap<string, WorkState> | null | undefined;

/** `predano` if submitted; `obavijest` if the notice is open; `rad` if started; else `zadatak`. */
export function kindOf(assignment: MyAssignment, states: States): RowKind {
  const state = states?.get(assignment.id);
  if (state === "submitted") return "predano";
  if (assignment.noticeFirst) return "obavijest";
  if (state === "in_progress") return "rad";
  return "zadatak";
}

/** The flat list of every visible assignment, courses in the read's order, each with its course. */
export function flatRows(courses: readonly MyCourse[], states: States, extras?: Extras): TaskRow[] {
  return courses.flatMap((course) =>
    course.assignments.map((assignment): TaskRow => {
      const extended = typeof assignment.extendedDueAt === "string" && assignment.extendedDueAt !== "";
      return {
        id: assignment.id, title: assignment.title, course: course.name, kind: kindOf(assignment, states),
        dueAt: extended ? (assignment.extendedDueAt as string) : assignment.dueAt, extended, originalDueAt: assignment.dueAt,
        typeLabel: assignment.workType === undefined ? t.taskFallback : t.workTypes[assignment.workType],
        practice: practiceOf(assignment),
        submitted: extras?.submitted.get(assignment.id) ?? null, extension: extras?.extensions.get(assignment.id) ?? null,
      };
    }));
}

/** The deadline as a time, or `Infinity` for one that does not parse, so such a row sorts last. */
const dueTime = (row: Pick<TaskRow, "dueAt">): number => {
  const due = Date.parse(row.dueAt);
  return Number.isNaN(due) ? Number.POSITIVE_INFINITY : due;
};

/**
 * P-4: the "nastavak rada" card is the started, unsubmitted work whose notice is
 * acknowledged and whose deadline is nearest (INVENTAR wins over the HTML's
 * fallback without the notice). Rows of kind `rad` are exactly those, since
 * `obavijest` is checked first. A tie keeps the read's order.
 */
export function continueRow(rows: readonly TaskRow[]): TaskRow | null {
  let best: TaskRow | null = null;
  for (const row of rows) {
    if (row.kind === "rad" && (best === null || dueTime(row) < dueTime(best))) best = row;
  }
  return best;
}

/** P-4: the order of the list; "rok" is the default, "kolegij" the read's own order. */
export type Order = "rok" | "kolegij";
export const ORDERS: readonly Order[] = ["rok", "kolegij"];

/** P-4: a deadline within this many days (or already passed) is "Uskoro". */
export const SOON_DAYS = 14;

export type SectionKey = "uskoro" | "kasnije" | "predano";
export type Section = { readonly key: SectionKey; readonly rows: readonly TaskRow[] };

/**
 * P-4 (E-2d, E-2e): the list by deadline, nearest first, in "Uskoro" (up to
 * SOON_DAYS ahead, or already passed), "Kasnije" and "Predano" (submitted rows at
 * the bottom). Empty sections are left out; a stable sort keeps the read's order
 * for equal deadlines. Order "kolegij" is one section of the rows as read, so
 * the list is only reordered when the student does not ask for the old order.
 */
export function sections(rows: readonly TaskRow[], now: number, order: Order = "rok"): Section[] {
  if (order === "kolegij") return rows.length === 0 ? [] : [{ key: "uskoro", rows }];
  const byDue = (a: TaskRow, b: TaskRow) => (dueTime(a) === dueTime(b) ? 0 : dueTime(a) < dueTime(b) ? -1 : 1);
  const open = rows.filter((row) => row.kind !== "predano").sort(byDue);
  const horizon = now + SOON_DAYS * 86_400_000;
  const groups: Section[] = [
    { key: "uskoro", rows: open.filter((row) => dueTime(row) <= horizon) },
    { key: "kasnije", rows: open.filter((row) => dueTime(row) > horizon) },
    { key: "predano", rows: rows.filter((row) => row.kind === "predano").sort(byDue) },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

/**
 * P-12 (E-2g): the courses without any visible assignment, all of them (not only
 * the first), in the read's order. Used when no row is visible at all.
 */
export function coursesWithoutTask(courses: readonly MyCourse[]): MyCourse[] {
  return courses.filter((course) => course.assignments.length === 0);
}

/** PAR2-A3: E-2 uses the same deadline tag as E-3. */
export { nearTag };

/** P-3 (E-2a): the row's deadline tag; the rule itself is the one function of courses/model.ts, shared with E-3 and E-4. */
export type { DeadlineTag };

export function deadlineTag(row: Pick<TaskRow, "kind" | "dueAt" | "extended" | "originalDueAt">, now: number): DeadlineTag | null {
  return deadlineTagOf({ submitted: row.kind === "predano", dueAt: row.dueAt, extended: row.extended, originalDueAt: row.originalDueAt }, now);
}

/** P-11: the one code rule (enrol/code.ts), the same as on E-5 and before sending. */
export const normalizeCode = cleanCode;

/** Where a row opens (R-9): a submitted work its receipt, an open notice the notice, else the work. */
export function rowRoute(row: Pick<TaskRow, "id" | "kind">): string {
  const id = encodeURIComponent(row.id);
  if (row.kind === "predano") return `/rad/${id}/predaja/potvrda`;
  if (row.kind === "obavijest") return `/zadatak/${id}`;
  return `/rad/${id}`;
}

/** The enrolment page with the code carried over (R-10), or without one. */
export function enrollRoute(code: string): string {
  const normal = normalizeCode(code);
  return normal === "" ? "/upis" : `/upis?kod=${encodeURIComponent(normal)}`;
}

/** The button label of a row (btn()): "Otvori rad", "Pročitaj upute" or "Otvori zadatak". */
export function rowAction(kind: RowKind): { label: string; primary: boolean } {
  if (kind === "predano") return { label: t.openWork, primary: false };
  if (kind === "obavijest") return { label: t.readNotice, primary: false };
  return { label: kind === "rad" ? t.openWork : t.openTask, primary: true };
}

/** NF-1 P-6: "Predano {vrijeme}" or "Predano {vrijeme}, nakon roka"; plain "Predano" while no time is known. */
export function submittedText(row: Pick<TaskRow, "submitted">, format: (iso: string) => string): string {
  return submittedLine(row.submitted, format);
}

/** NF-1 P-7: the history line of an extended, unsubmitted row, or null when the history is not known. */
export function extensionLine(row: Pick<TaskRow, "kind" | "extended" | "extension">, format: (iso: string) => string): string | null {
  if (row.kind === "predano" || !row.extended || !row.extension) return null;
  return extensionText(row.extension, format);
}
