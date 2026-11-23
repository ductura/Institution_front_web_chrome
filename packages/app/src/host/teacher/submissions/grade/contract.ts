// Whether an assignment is graded (PIL-D1-BEZ-OCJENE, P-D1). Server operation:
//   teacher.assignment-grade.get  -> 200 { eligible: true } | 409 practice_assignment
// A practice assignment is never graded and never exported: the 409 is the server's calm answer
// "probni zadatak", not a failure, and the screens show it as a note. Only a 200 that says exactly
// `eligible: true` offers the grade and export actions; anything else offers none of them.
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type GradeCall = (
  id: "teacher.assignment-grade.get",
  input: { readonly params: Readonly<Record<string, string>>; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type GradeRead =
  | { readonly kind: "graded" }
  | { readonly kind: "practice" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

const ELIGIBLE: Schema = {
  type: "object", additionalProperties: false, required: ["eligible"], properties: { eligible: { const: true } },
};

/** Reads the grade route of one assignment; a thrown transport is "unavailable", never "graded". */
export async function readGrade(call: GradeCall, assignmentId: string): Promise<GradeRead> {
  if (assignmentId.length === 0) return { kind: "notFound" };
  try {
    const result = await call("teacher.assignment-grade.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (result.ok) return result.status === 200 && matchesSchema(ELIGIBLE, result.body) ? { kind: "graded" } : { kind: "unavailable" };
    if (result.status === 409 && result.code === "practice_assignment") return { kind: "practice" };
    if (result.status === 401) return { kind: "signedOut" };
    if (result.status === 403 || result.status === 404) return { kind: "notFound" };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** What the screen puts where the grade and export actions go. */
export type GradeSlot = "waiting" | "actions" | "practice" | "unavailable" | "none";

/**
 * Only a confirmed regular assignment offers the actions. A practice assignment gets the calm note; a
 * failed read gets a retry, never the actions (a practice assignment must not be exported by accident).
 */
export function gradeSlot(read: GradeRead | null): GradeSlot {
  if (read === null) return "waiting";
  if (read.kind === "graded") return "actions";
  if (read.kind === "practice") return "practice";
  if (read.kind === "unavailable") return "unavailable";
  return "none";
}
