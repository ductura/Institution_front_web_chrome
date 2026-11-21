import type { AssignmentAction } from "../../../../../../src/components/student/MyAssignments";
import { StartWork } from "./StartWork";

/**
 * WEB-1402: "Započni rad" on each card whose notice is acknowledged. An
 * unacknowledged one keeps "Pročitaj upute" alone: the notice comes first
 * (PRODUCT §5 rule 6), and the server would refuse the start anyway.
 */
export const startWorkAction: AssignmentAction = (assignment) =>
  assignment.noticeFirst ? null : <StartWork assignmentId={assignment.id} title={assignment.title} />;
