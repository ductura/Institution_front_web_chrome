// Pure rules of the course aggregate (WEB-1706; plan M6.10, N-17, D-242). The view shows shares of a
// closed list of measures for the whole course: no names, no scale, no ranking. Below the threshold
// the whole view is replaced by the "suppressed" state; a measure whose count or whose complement
// is below the threshold is hidden too, because the complement would give a small group away.
// No server route exists yet: the port is the smallest contract the plan implies (a probe answer
// stands in for it in the tests). This module makes no network call.
import { courseAggregateMessages as text } from "./messages.hr";

/** Fewest students for which anything is shown (M6.10). */
export const MIN_STUDENTS = 5;

/** The closed list of measures; nothing outside it is ever shown. */
export const MEASURES = ["submitted", "afterDeadline", "continuous", "withGaps"] as const;
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
  read(courseId: string): Promise<AggregateRead>;
}

export type MeasureView =
  | { readonly key: MeasureKey; readonly label: string; readonly shown: true; readonly count: number; readonly percent: number; readonly summary: string }
  | { readonly key: MeasureKey; readonly label: string; readonly shown: false };

export type AggregateView =
  | { readonly kind: "ready"; readonly students: number; readonly measures: readonly MeasureView[]; readonly chartAlt: string }
  | { readonly kind: "empty" }
  | { readonly kind: "suppressed" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const LABELS: Readonly<Record<MeasureKey, string>> = {
  submitted: text.measureSubmitted,
  afterDeadline: text.measureAfterDeadline,
  continuous: text.measureContinuous,
  withGaps: text.measureWithGaps,
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
export function aggregateView(read: AggregateRead): AggregateView {
  if (read.kind !== "ready") return { kind: read.kind };
  const { students, counts } = read.data;
  if (!Number.isInteger(students) || students < 0) return { kind: "unavailable" };
  if (students === 0) return { kind: "empty" };
  if (students < MIN_STUDENTS) return { kind: "suppressed" };
  const measures = MEASURES.map((key) => measureView(key, counts[key], students));
  return { kind: "ready", students, measures, chartAlt: chartAlt(measures) };
}

/** Reads through the port; a failure is "unavailable", never a made-up value. */
export async function loadAggregate(port: CourseAggregatePort, courseId: string): Promise<AggregateView> {
  try {
    return aggregateView(await port.read(courseId));
  } catch {
    return { kind: "unavailable" };
  }
}
