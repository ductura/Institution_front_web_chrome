import type { WizardOutcome } from "@ductura/ui";

import type { AssignmentCreation } from "@/components/teacher/assignment-create";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { publishHr } from "./messages.hr";

const errors = messagesHr.teacher.assignment.errors;

/**
 * Maps the server's answer to the wizard outcome (B-6: success only after the server confirmed).
 * A refusal keeps the entered data and says the server refused; an unknown outcome locks the form and
 * says so, with the prototype wording; both keep the specific reason from the shared catalogue.
 */
export function publishOutcome(result: AssignmentCreation): WizardOutcome {
  if (result.kind === "available") return { ok: true };
  if (result.kind === "unavailable") return { ok: false, uncertain: true, error: `${publishHr.uncertainTitle} ${publishHr.uncertainBody}` };
  return { ok: false, error: `${publishHr.refused} ${errors[result.kind]}` };
}

/** True when the outcome of a publish is not known and the list of assignments must be checked before another try. */
export function isUncertain(result: AssignmentCreation): boolean {
  return result.kind === "unavailable";
}
