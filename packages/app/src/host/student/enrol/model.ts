import { enrollError } from "../../../../../../src/components/student/upis/EnrollForm.tsx";
import type { EnrollResult } from "../../../../../../src/components/student/upis/enroll.ts";

import { enrolErrors } from "./messages.hr";

/** The text under the field: the prototype's MSG for its three states, the shared one otherwise. */
export function enrolError(result: EnrollResult | null): string | null {
  if (result && result.kind in enrolErrors) return enrolErrors[result.kind as keyof typeof enrolErrors];
  return enrollError(result);
}

/** The code of ?kod as R-10 stores it: trimmed, upper case; null when absent. */
export function codeFromQuery(search: string): string | null {
  const raw = new URLSearchParams(search).get("kod");
  const code = raw?.trim().toUpperCase();
  return code ? code.slice(0, 64) : null;
}

/** Where "Otvori editor" goes: the editor of this assignment, not the pending /rad page. */
export function editorPath(assignmentId: string): string {
  return `/rad/${encodeURIComponent(assignmentId)}`;
}
