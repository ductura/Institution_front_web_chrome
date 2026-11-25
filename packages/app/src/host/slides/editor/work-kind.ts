// WEB-V13-UREDNIK: which editor a work opens in. `documentKind` is read from the
// assignment's row in the answer of student.assignments.get (SRV-V13-UGOVOR-VRSTA);
// an answer without the field is a text work, and a value the client does not
// know is "unreadable" (the page says so, it does not guess).
import { readDocumentKind } from "../../../../../editor-core/src/slides/index.ts";

export type WorkKind = "text" | "slides" | "unreadable";

type Rows = { readonly courses?: readonly { readonly assignments?: readonly unknown[] }[] };

export function workKindOf(assignments: { readonly ok?: boolean; readonly body?: unknown }, assignmentId: string): WorkKind {
  if (assignments.ok !== true) return "text";
  const body = assignments.body as Rows | null | undefined;
  for (const course of body?.courses ?? []) {
    for (const row of course.assignments ?? []) {
      const id = typeof row === "object" && row !== null ? (row as { id?: unknown }).id : undefined;
      if (typeof id !== "string" || id.toLowerCase() !== assignmentId) continue;
      const kind = readDocumentKind(row);
      return kind.ok ? kind.kind : "unreadable";
    }
  }
  return "text";
}
