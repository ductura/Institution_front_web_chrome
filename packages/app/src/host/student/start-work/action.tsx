import type { ReactNode } from "react";

import type { MyAssignment } from "../read/assignments";
import { StartWork } from "./StartWork";

/**
 * WEB-1402: "Započni rad" on each card whose notice is acknowledged. An
 * unacknowledged one keeps "Pročitaj upute" alone: the notice comes first
 * (PRODUCT §5 rule 6), and the server would refuse the start anyway.
 */
/** An action the host draws on an assignment's card under its link; null draws nothing. */
export type AssignmentAction = (assignment: MyAssignment) => ReactNode;

export const startWorkAction: AssignmentAction = (assignment) =>
  assignment.noticeFirst ? null : <StartWork assignmentId={assignment.id} title={assignment.title} />;
