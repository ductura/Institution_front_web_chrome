/**
 * The teacher's working criteria for one work (WEB-1112; E 3.5 mentor3, B-9).
 * Six criteria are the teacher's working note: the student never sees them
 * and never asks for them (B-9, 19. 11. 2026), so nothing in the student's
 * code imports this module.
 *
 * Both routes are in the migration contract in the server's shape (LOK-WEB-20,
 * openapi v1). teacher.working-criteria.get answers 200 {criteria}: always the
 * same six criteria, each named by a fixed id (`topic` … `formatting`) and a
 * message key as its label, never a sentence. teacher.working-criterion.put,
 * with the criterion id in the path and {assessment, note}, answers 200 with
 * the saved criterion. An assessment is 0 "treba doraditi", 1 "dobro" or
 * 2 "vrlo dobro": a label, never points; `null` clears it. A write counts as
 * saved only when the answer names the same criterion and carries exactly what
 * was sent (B-6): anything else is "nepoznato" and the form keeps its draft.
 * The caller passes the transport (`CriteriaCall`).
 */

import { matchesSchema, type Schema } from "./schema-check";
import type { Read } from "./submission";

export const CRITERION_IDS = ["topic", "structure", "sources", "method", "language", "formatting"] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];
export const ASSESSMENTS = [0, 1, 2] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const NOTE_MAX = 2000;
export const CRITERIA_COUNT = CRITERION_IDS.length;

export type WorkingCriterion = {
  readonly id: CriterionId;
  /** The message key of the criterion's text (`workingCriteria.<id>`). */
  readonly label: string;
  readonly assessment: Assessment | null;
  readonly note: string | null;
};

export type CriterionInput = { readonly assessment: Assessment | null; readonly note: string | null };

export type CriteriaCall = (
  id: "teacher.working-criteria.get" | "teacher.working-criterion.put",
  input: {
    readonly params: { readonly documentId: string; readonly criterionId?: CriterionId };
    readonly query: undefined;
    readonly body?: CriterionInput;
  },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type CriteriaRead = Read<{ readonly kind: "ready"; readonly criteria: readonly WorkingCriterion[] }>;
export type CriterionWrite =
  | { readonly kind: "saved"; readonly criterion: WorkingCriterion }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the write may be recorded. */
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const CODE_POINT = "[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]";
// openapi v1: a work id is 1 to 256 code points, trimmed, without a control character.
const WORK_ID: Schema = {
  type: "string",
  pattern: `^(?!\\s)(?:${CODE_POINT}|[^\\u0000-\\u001f\\u007f-\\u009f\\uD800-\\uDFFF]){1,256}(?<!\\s)(?![\\s\\S])`,
};
const CRITERION_ID: Schema = { anyOf: CRITERION_IDS.map((id) => ({ const: id })) };
const ASSESSMENT: Schema = { anyOf: [{ type: "null" }, ...ASSESSMENTS.map((a) => ({ const: a }))] };
const NOTE: Schema = { anyOf: [{ type: "null" }, { type: "string", minLength: 1, maxLength: NOTE_MAX }] };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const CRITERION: Schema = closed({
  id: CRITERION_ID, label: { type: "string", pattern: "^workingCriteria\\.[a-z]+$" }, assessment: ASSESSMENT, note: NOTE,
});
const LIST: Schema = closed({ criteria: { type: "array", minItems: CRITERIA_COUNT, maxItems: CRITERIA_COUNT, items: CRITERION } });

/** teacher.working-criteria.get. Exactly the six distinct criteria, else the read is unknown. Never throws. */
export async function readWorkingCriteria(call: CriteriaCall, documentId: string): Promise<CriteriaRead> {
  if (!matchesSchema(WORK_ID, documentId)) return { kind: "greska", code: "invalid" };
  try {
    const result = await call("teacher.working-criteria.get", { params: { documentId }, query: undefined });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return UNKNOWN;
    const { criteria } = result.body as { criteria: WorkingCriterion[] };
    return new Set(criteria.map((c) => c.id)).size === criteria.length ? { kind: "ready", criteria } : UNKNOWN;
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
  call: CriteriaCall, documentId: string, criterionId: CriterionId, input: CriterionInput,
): Promise<CriterionWrite> {
  if (!matchesSchema(WORK_ID, documentId) || !matchesSchema(CRITERION_ID, criterionId) || !criterionSendable(input)) {
    return { kind: "greska", code: "invalid" };
  }
  const body: CriterionInput = { assessment: input.assessment, note: input.note };
  try {
    const result = await call("teacher.working-criterion.put", { params: { documentId, criterionId }, query: undefined, body });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(CRITERION, result.body)) return UNKNOWN;
      const saved = result.body as WorkingCriterion;
      return saved.id === criterionId && saved.assessment === body.assessment && saved.note === body.note
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
