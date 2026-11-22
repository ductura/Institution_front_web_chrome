// WEB-2106: which panel a step shows for the assignment as the server gave it.
// A plain module so the decision is tested without rendering.
export type StepKind = "declaration" | "beforeSubmit";

/** The checked assignment a step stands on (what `useChecked` reads). */
export type StepWork =
  | { readonly kind: "ready"; readonly course: string; readonly title: string; readonly workState: string }
  | { readonly kind: "unavailable" };

export type StepPanel =
  | { readonly kind: "error" }
  | { readonly kind: "notStarted" }
  | { readonly kind: "submitted" }
  | { readonly kind: "normal" };

/**
 * Error first (the state of the work is unknown, so nothing is claimed about
 * it); then a work not started; then a submitted one, which no longer changes
 * (E-8 `predano`, E-9 "Izjava je predana s radom"). Anything else is the
 * ordinary step; the closed deadline stays a note inside it.
 */
export function stepPanelOf(work: StepWork): StepPanel {
  if (work.kind === "unavailable") return { kind: "error" };
  if (work.workState === "not_started") return { kind: "notStarted" };
  if (work.workState === "submitted") return { kind: "submitted" };
  return { kind: "normal" };
}

/** "Kolegij · naslov" for the bar; the title alone when no course is known. */
export function pathOf(work: StepWork, separator: string): string {
  if (work.kind !== "ready") return "";
  return work.course === "" ? work.title : `${work.course}${separator}${work.title}`;
}
