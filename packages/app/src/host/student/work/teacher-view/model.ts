import type { EditorWorkRead } from "../../../../../../../src/components/editor/EditorPage.read.ts";

export type TeacherViewRows = { readonly course: string; readonly title: string; readonly dueAt: string; readonly workState: "not_started" | "in_progress" | "submitted" };

/** The rows of the view, only from a read the student already has (student.assignments.get, student.assignment-work.get). */
export function rowsOf(read: EditorWorkRead): TeacherViewRows | null {
  return read.kind === "ready" ? { course: read.course, title: read.title, dueAt: read.dueAt, workState: read.workState } : null;
}
