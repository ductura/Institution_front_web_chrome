/**
 * The teacher's working criteria for one work (WEB-1112; E 3.5 mentor3, B-9).
 * Six criteria are the teacher's working note: the student never sees them
 * and never asks for them (B-9, 19. 11. 2026), so nothing in the student's
 * code imports this module.
 *
 * teacher.working-criteria.get answers 200 {criteria} (no body) and
 * teacher.working-criterion.put, with the criterion id in the path and
 * {assessment, note}, answers 200 with the saved criterion. `assessment: null`
 * clears the assessment. A write counts as saved only when the answer names
 * the same criterion and carries exactly what was sent (B-6): anything else
 * is "nepoznato" and the form keeps its draft.
 *
 * TODO(ugovor): both routes are not in @ductura/contracts yet. Until then the
 * shapes are local, the caller passes the transport (`CriteriaCall`) and only
 * tests call them, with invented answers.
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export const ASSESSMENTS = ["needs_work", "good", "very_good"] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const NOTE_MAX = 600;
export const CRITERIA_COUNT = 6;

export type WorkingCriterion = {
  readonly criterionId: string;
  readonly title: string;
  readonly assessment: Assessment | null;
  readonly note: string | null;
};

export type CriterionInput = { readonly assessment: Assessment | null; readonly note: string | null };

export type CriteriaCall = (
  id: "teacher.working-criteria.get" | "teacher.working-criterion.put",
  input: { readonly documentId: string; readonly criterionId?: string; readonly body?: CriterionInput },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type CriteriaRead = Read<{ readonly kind: "ready"; readonly criteria: readonly WorkingCriterion[] }>;
export type CriterionWrite =
  | { readonly kind: "saved"; readonly criterion: WorkingCriterion }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the write may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const ASSESSMENT: Schema = { anyOf: [{ type: "null" }, ...ASSESSMENTS.map((a) => ({ const: a }))] };
const NOTE: Schema = { anyOf: [{ type: "null" }, { type: "string", minLength: 1, maxLength: NOTE_MAX }] };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const CRITERION: Schema = closed({
  criterionId: UUID, title: { type: "string", minLength: 1, maxLength: 160 }, assessment: ASSESSMENT, note: NOTE,
});
const LIST: Schema = closed({ criteria: { type: "array", minItems: CRITERIA_COUNT, maxItems: CRITERIA_COUNT, items: CRITERION } });

/** teacher.working-criteria.get. Exactly six distinct criteria, else the read is unknown. Never throws. */
export async function readWorkingCriteria(call: CriteriaCall, documentId: string): Promise<CriteriaRead> {
  if (!matchesSchema(UUID, documentId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("teacher.working-criteria.get", { documentId });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { criteria } = result.body as { criteria: WorkingCriterion[] };
    return new Set(criteria.map((c) => c.criterionId)).size === criteria.length ? { kind: "ready", criteria } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** False when the input must not be sent: an unknown assessment, a blank or over-long note. */
export function criterionSendable(input: CriterionInput): boolean {
  return matchesSchema(ASSESSMENT, input.assessment) && matchesSchema(NOTE, input.note)
    && (input.note === null || input.note.trim() !== "");
}

/** teacher.working-criterion.put. Never throws. */
export async function saveWorkingCriterion(
  call: CriteriaCall, documentId: string, criterionId: string, input: CriterionInput,
): Promise<CriterionWrite> {
  if (!matchesSchema(UUID, documentId) || !matchesSchema(UUID, criterionId) || !criterionSendable(input)) {
    return { kind: "greska", code: "invalid" };
  }
  const body: CriterionInput = { assessment: input.assessment, note: input.note };
  try {
    const result = await call("teacher.working-criterion.put", { documentId, criterionId, body });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(CRITERION, result.body)) return UNKNOWN;
      const saved = result.body as WorkingCriterion;
      return saved.criterionId === criterionId && saved.assessment === body.assessment && saved.note === body.note
        ? { kind: "saved", criterion: saved }
        : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    if (result.status === 422) return { kind: "greska", code: "invalid" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
