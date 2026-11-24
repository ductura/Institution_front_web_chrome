import { enrollError } from "../../../../../../src/components/student/upis/EnrollForm.tsx";
import type { EnrollResult } from "../../../../../../src/components/student/upis/enroll.ts";

import { CODE_RAW_MAX, cleanCode } from "./code";
import { enrolErrors } from "./messages.hr";

/** The text of a refusal: the prototype's MSG for the states it names, the shared one otherwise. */
export function enrolError(result: EnrollResult | null): string | null {
  if (result && result.kind in enrolErrors) return enrolErrors[result.kind as keyof typeof enrolErrors];
  return enrollError(result);
}

/** The refusals that are about the code itself: only these mark the field invalid (aria-invalid). */
const CODE_KINDS: ReadonlySet<string> = new Set(["malformed", "invalidCode", "expiredCode"]);

/**
 * P-10 (E-5a): where a refusal is said. A wrong code is the field's error; too many
 * attempts, no connection and the other refusals are about the attempt, not the
 * code, so they are said apart from the field, without aria-invalid (as `mreza`).
 */
export function enrolErrorPlace(result: EnrollResult | null): { field: string | null; form: string | null } {
  const text = enrolError(result);
  if (text === null || result === null) return { field: null, form: null };
  return CODE_KINDS.has(result.kind) ? { field: text, form: null } : { field: null, form: text };
}

/** The code of ?kod by the one rule of P-11 (no spaces or hyphens, capitals); null when absent. */
export function codeFromQuery(search: string): string | null {
  const raw = new URLSearchParams(search).get("kod");
  const code = raw === null ? "" : cleanCode(raw);
  return code ? code.slice(0, CODE_RAW_MAX) : null;
}

/** Where "Otvori editor" goes: the editor of this assignment, not the pending /rad page. */
export function editorPath(assignmentId: string): string {
  return `/rad/${encodeURIComponent(assignmentId)}`;
}
