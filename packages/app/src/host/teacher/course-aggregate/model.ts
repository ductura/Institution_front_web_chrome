// Pure rules of the course aggregate (WEB-1706; plan M6.10, N-17, D-242). The view shows shares of a
// closed list of measures for the whole course: no names, no scale, no ranking. Below the threshold
// the whole view is replaced by the "suppressed" state; a measure whose count or whose complement
// is below the threshold is hidden too, because the complement would give a small group away.
// The real port (./port.ts, PIL-K-ZBIRNO) reads course.aggregate.get; its measures are the stages the
// route gives (not started, in progress, submitted). This module makes no network call.
// P-D1 (PIL-D1-BEZ-OCJENE): a practice assignment never enters the aggregate. The port is asked only for
// the course's other assignments; a course with practice assignments only has its own state.
import { courseAggregateMessages as text } from "./messages.hr";

/** Fewest students for which anything is shown (M6.10). */
export const MIN_STUDENTS = 5;

/** The closed list of measures; nothing outside it is ever shown. */
export const MEASURES = ["submitted", "inProgress", "notStarted"] as const;
export type MeasureKey = (typeof MEASURES)[number];

export type AggregateData = {
  readonly students: number;
  readonly counts: Readonly<Record<MeasureKey, number>>;
};

export type AggregateRead =
  | { readonly kind: "ready"; readonly data: AggregateData }
  | { readonly kind: "suppressed" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface CourseAggregatePort {
  /**
   * The aggregate of the course over exactly these assignments (never a practice one). course.aggregate.get
   * takes only the course: the real port asks it only when such an assignment exists (see ./port.ts).
   */
  read(courseId: string, assignmentIds: readonly string[]): Promise<AggregateRead>;
}

/** An assignment of the course with the server's flag (`isPractice` of institution.assignment.get). */
export type CourseAssignment = { readonly assignmentId: string; readonly isPractice?: boolean };

/** The assignments the aggregate covers: all but the practice ones. Only an explicit `true` is practice. */
export function aggregateScope(assignments: readonly CourseAssignment[]): readonly string[] {
  return assignments.filter((a) => a.isPractice !== true).map((a) => a.assignmentId);
}

export type MeasureView =
  | { readonly key: MeasureKey; readonly label: string; readonly shown: true; readonly count: number; readonly percent: number; readonly summary: string }
  | { readonly key: MeasureKey; readonly label: string; readonly shown: false };

export type AggregateView =
  | {
    readonly kind: "ready"; readonly students: number; readonly measures: readonly MeasureView[]; readonly chartAlt: string;
    /** How many practice assignments were left out, for the note under the view. */
    readonly practiceLeftOut: number;
  }
  | { readonly kind: "empty" }
  | { readonly kind: "practiceOnly" }
  | { readonly kind: "suppressed" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const LABELS: Readonly<Record<MeasureKey, string>> = {
  submitted: text.measureSubmitted,
  inProgress: text.measureInProgress,
  notStarted: text.measureNotStarted,
};

const valid = (n: number, max: number): boolean => Number.isInteger(n) && n >= 0 && n <= max;

/** A measure is shown only when both the group and its complement reach the threshold. */
export function measureView(key: MeasureKey, count: number, students: number): MeasureView {
  const label = LABELS[key];
  if (!valid(count, students) || count < MIN_STUDENTS || students - count < MIN_STUDENTS) return { key, label, shown: false };
  const percent = Math.round((count / students) * 100);
  return { key, label, shown: true, count, percent, summary: text.shareOf(count, students, percent) };
}

/** The text alternative of the chart: every measure, read out in the order of the closed list. */
export function chartAlt(measures: readonly MeasureView[]): string {
  return text.chartAlt(measures.map((m) => (m.shown ? text.chartPart(m.label, m.percent) : text.chartPartHidden(m.label))));
}

/** Turns a port answer into the view; a count below the threshold never reaches the screen. */
export function aggregateView(read: AggregateRead, practiceLeftOut = 0): AggregateView {
  if (read.kind !== "ready") return { kind: read.kind };
  const { students, counts } = read.data;
  if (!Number.isInteger(students) || students < 0) return { kind: "unavailable" };
  if (students === 0) return { kind: "empty" };
  if (students < MIN_STUDENTS) return { kind: "suppressed" };
  const measures = MEASURES.map((key) => measureView(key, counts[key], students));
  return { kind: "ready", students, measures, chartAlt: chartAlt(measures), practiceLeftOut };
}

/**
 * Reads through the port over the assignments that are not practice; a failure is "unavailable", never a
 * made-up value. Without such an assignment nothing is read: "empty", or "practiceOnly" when the course has
 * practice assignments only.
 */
export async function loadAggregate(port: CourseAggregatePort, courseId: string, assignments: readonly CourseAssignment[]): Promise<AggregateView> {
  const scope = aggregateScope(assignments);
  if (scope.length === 0) return { kind: assignments.length === 0 ? "empty" : "practiceOnly" };
  try {
    return aggregateView(await port.read(courseId, scope), assignments.length - scope.length);
  } catch {
    return { kind: "unavailable" };
  }
}

/** This screen's own path: where sign-in returns after a 401. */
export function aggregatePath(courseId: string): string {
  return `/nastavnik/kolegiji/${encodeURIComponent(courseId)}/zbirno`;
}
