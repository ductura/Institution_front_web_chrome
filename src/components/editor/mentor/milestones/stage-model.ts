import type { Stage } from "./stages-api";

export type StageDot = "waiting" | "submitted" | "revision" | "approved";

const DOT: Record<Stage["state"], StageDot> = {
  not_submitted: "waiting", submitted: "submitted", revision_requested: "revision", approved: "approved",
};

export const stageDot = (stage: Stage): StageDot => DOT[stage.state];

/** The mentor may ask for a revision or approve only what has been submitted. */
export const mayDecide = (stage: Stage): boolean => stage.state === "submitted";

/** A stage that was ever submitted can only be renamed: deleting it would lose what the student sent. */
export const mayDelete = (stage: Stage): boolean => !stage.everSubmitted && stage.state === "not_submitted";

export function approvedCount(stages: readonly Stage[]): number {
  return stages.filter((stage) => stage.state === "approved").length;
}

/** Trimmed text for an optional field: nothing typed is `undefined`, never an empty string (the contract wants 1+ characters). */
export const optionalText = (value: string): string | undefined => value.trim() === "" ? undefined : value.trim();
