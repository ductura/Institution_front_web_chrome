// WEB-V16-OBRANA: the pure rules of the stage form. `defenseAt` is required for "defense_scheduled" and
// forbidden for every other stage (a correction of the date is the same stage sent again).
import { formatDateTime } from "@ductura/ui";

import { zagrebInstant, zagrebLocalMinute } from "../../../../../../src/lib/i18n/zagreb";

export type Stage = "none" | "submitted_to_office" | "defense_scheduled" | "defended";
export const STAGES: readonly Stage[] = ["none", "submitted_to_office", "defense_scheduled", "defended"];
export type StageBody = { readonly stage: Stage; readonly defenseAt?: string };
export type StageView = {
  readonly stage: Stage;
  readonly defenseAt: string | null;
  readonly changedAt: string | null;
  readonly changedByPart: "mentor" | "faculty" | null;
};

export type Checked =
  | { readonly ok: true; readonly body: StageBody }
  | { readonly ok: false; readonly problem: "dateRequired" | "dateInvalid" };

/** The body of the write for a stage and the text of the `datetime-local` field (Zagreb time). */
export function checkStage(stage: Stage, local: string): Checked {
  if (stage !== "defense_scheduled") return { ok: true, body: { stage } };
  if (local.trim() === "") return { ok: false, problem: "dateRequired" };
  const instant = zagrebInstant(local.trim());
  return instant === null ? { ok: false, problem: "dateInvalid" } : { ok: true, body: { stage, defenseAt: instant } };
}

/** What the field shows for the stored date; "" when there is none. */
export const fieldOf = (defenseAt: string | null): string => (defenseAt === null ? "" : zagrebLocalMinute(defenseAt));

/** "14. prosinca 2026. u 10:30" in Zagreb time, or null for a text that is not an instant. */
export function formatDefense(defenseAt: string | null): string | null {
  if (defenseAt === null) return null;
  const local = zagrebLocalMinute(defenseAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const text = formatDateTime(defenseAt, "hr");
  return text === "" ? null : text;
}

export type StepState = "done" | "current" | "pending";
const STEPS = ["submitted_to_office", "defense_scheduled", "defended"] as const;
/** The three steps after the submission and where each stands; "none" has no step done or current. */
export function stepsOf(stage: Stage): readonly { readonly id: (typeof STEPS)[number]; readonly state: StepState }[] {
  const at = stage === "none" ? -1 : STEPS.indexOf(stage);
  return STEPS.map((id, i) => ({ id, state: stage === "defended" || i < at ? "done" : i === at ? "current" : "pending" }));
}
