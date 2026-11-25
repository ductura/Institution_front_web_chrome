// WEB-V17-RUBRIC-MARK: the routes the marks use, through the shared client (no direct network calls).
import type { createApi } from "@/client/api";

import type { Rubric, RubricCriterion } from "../../rubric/rubric-model";
import type { Level, Mark } from "./rubric-marks-model";

export type Call = ReturnType<typeof createApi>;
export type MarksRead =
  | { kind: "ready"; rubricVersion: number; currentVersion: number; rubric: Rubric; marks: readonly Mark[] }
  /** No rubric of the assignment: the private working criteria stay as they are. */
  | { kind: "none" }
  | { kind: "signedOut" }
  | { kind: "notFound" }
  | { kind: "unavailable" };
export type MarkSave = { kind: "saved"; mark: Mark } | { kind: "signedOut" }
  | { kind: "gone" }
  | { kind: "failed" };

const status = (s: number): { kind: "signedOut" } | { kind: "notFound" } | { kind: "unavailable" } =>
  s === 401 ? { kind: "signedOut" } : s === 404 ? { kind: "notFound" } : { kind: "unavailable" };

/**
 * Reads the work (for its assignment), the assignment's rubric and the work's marks. "none" when the assignment has
 * no rubric (version 0 or no criteria) or the work has no marks. A foreign or unknown work is 404 on every route.
 */
export async function readRubricMarks(call: Call, documentId: string): Promise<MarksRead> {
  try {
    const work = await call("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    if (!work.ok) return status(work.status);
    if (work.body.documentId !== documentId) return { kind: "unavailable" };
    const [rubric, marks] = await Promise.all([
      call("teacher.assignment-rubric.get", { params: { assignmentId: work.body.assignmentId }, query: undefined, body: undefined }),
      call("teacher.work-rubric.get", { params: { documentId }, query: undefined, body: undefined }),
    ]);
    if (!rubric.ok) return status(rubric.status);
    if (!marks.ok) return status(marks.status);
    if (rubric.body.version === 0 || rubric.body.criteria.length === 0 || marks.body.rubricVersion === 0) return { kind: "none" };
    const criteria: RubricCriterion[] = [];
    for (const c of rubric.body.criteria) {
      const [a, b, d] = c.levels;
      if (a === undefined || b === undefined || d === undefined || c.levels.length !== 3) return { kind: "unavailable" };
      criteria.push({ id: c.id, title: c.title, levels: [a, b, d] });
    }
    return {
      kind: "ready", rubricVersion: marks.body.rubricVersion, currentVersion: rubric.body.version,
      rubric: criteria,
      marks: marks.body.marks.map((m) => ({ criterionId: m.criterionId, level: m.level, note: m.note })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** teacher.work-rubric-mark.put; saved only when the answer names the criterion that was sent. */
export async function saveMark(call: Call, documentId: string, criterionId: string, level: Level | null, note: string | null): Promise<MarkSave> {
  try {
    const result = await call("teacher.work-rubric-mark.put", { params: { documentId, criterionId }, query: undefined, body: { level, note } });
    if (result.ok) {
      const b = result.body;
      return b.criterionId === criterionId ? { kind: "saved", mark: { criterionId, level: b.level, note: b.note } } : { kind: "failed" };
    }
    return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "gone" : "failed" };
  } catch {
    return { kind: "failed" };
  }
}
