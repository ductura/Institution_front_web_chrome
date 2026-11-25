// WEB-V17-RUBRIC-FORM: the one route the rubric field uses, through the shared client (no direct network calls).
import type { createApi } from "@/client/api";

import { toCriteria, type Rubric } from "./rubric-model";

export type Call = ReturnType<typeof createApi>;
/** "none": no rubric was chosen, nothing was sent. "conflict": the server holds another version (409). */
export type SaveOutcome = "saved" | "none" | "conflict" | "signedOut" | "failed";

/**
 * teacher.assignment-rubric.put for a freshly created assignment (expectedVersion 0). Saved only when the answer
 * repeats the criteria that were sent; an invalid or empty rubric sends nothing.
 */
export async function saveRubric(call: Call, assignmentId: string, rubric: Rubric, expectedVersion = 0): Promise<SaveOutcome> {
  const criteria = toCriteria(rubric);
  if (criteria === null) return "none";
  try {
    const result = await call("teacher.assignment-rubric.put", { params: { assignmentId }, query: undefined, body: { expectedVersion, criteria } });
    if (!result.ok) return result.status === 401 ? "signedOut" : result.status === 409 ? "conflict" : "failed";
    return result.body.criteria.length === criteria.length && result.body.criteria.every((c, i) => c.id === criteria[i]!.id) ? "saved" : "failed";
  } catch {
    return "failed";
  }
}
