// WEB-V16-ETAPE-STUDENT: the pure rules of the student's "Etape" section.
import { formatDateTime } from "@ductura/ui";

import type { StudentMilestone } from "../../../../../../src/client/milestone-submit";
import type { SectionRead, ThesisRole } from "../model";

export type StageList = readonly StudentMilestone[];

/**
 * How the milestones read ends. 404 is a work the server does not show; any other failure is "unavailable",
 * never "empty" (B-6). The mentor has his own controls in WorkPlan, so this section shows nothing to him.
 */
export function stagesRead(
  role: ThesisRole,
  result: { readonly ok: boolean; readonly status: number; readonly body?: unknown },
): SectionRead<StageList> {
  if (role !== "student") return { kind: "notFound" };
  if (!result.ok) return result.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
  const list = (result.body as { milestones?: StageList } | undefined)?.milestones;
  if (!Array.isArray(list)) return { kind: "unavailable" };
  return list.length === 0 ? { kind: "empty" } : { kind: "ready", value: list };
}

/** A deadline for the screen in Zagreb time, with the time of day; null when missing or not a date. */
export function showDate(iso: string | null): string | null {
  if (iso === null) return null;
  const time = Date.parse(iso);
  // "10. studenoga 2026. u 23:59": the full month, never "10. stu 2026. 23:59" (A3).
  return Number.isNaN(time) ? null : formatDateTime(time, "hr");
}
