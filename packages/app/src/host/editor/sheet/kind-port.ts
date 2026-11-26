// WEB-V14-SHEET-PAGE: which kind a work is, for the page that opens it. The kind comes from the assignment's row in
// the answer of student.assignments.get: `vrsta = workKind ?? documentKind ?? "text"` (SRV-V14-KIND-ENUM v2, decision b).
// A row that names no kind is a text work; a value this client does not know is "unreadable", and the page says so
// ("nedostupno"), it never opens it as text.
export type PageKind = "text" | "slides" | "spreadsheet" | "unreadable";

const KNOWN: ReadonlySet<unknown> = new Set(["text", "slides", "spreadsheet"]);

type Row = { readonly id?: unknown; readonly workKind?: unknown; readonly documentKind?: unknown };
type Rows = { readonly courses?: readonly { readonly assignments?: readonly unknown[] }[] };

/** The kind of one row: workKind first, documentKind next, "text" when neither is given. */
export function kindOfRow(row: Row): PageKind {
  const given = row.workKind ?? row.documentKind;
  if (given === undefined || given === null) return "text";
  return KNOWN.has(given) ? (given as PageKind) : "unreadable";
}

/**
 * The kind of the work of `assignmentId` (lower case). A failed read of the assignments is "unreadable", not
 * "text": the page shows "nedostupno" instead of guessing. An assignment not in the answer is "text" (the page's
 * own not-found handling has already decided about it).
 */
export function pageKindOf(assignments: { readonly ok?: boolean; readonly body?: unknown }, assignmentId: string): PageKind {
  if (assignments.ok !== true) return "unreadable";
  const body = assignments.body as Rows | null | undefined;
  for (const course of body?.courses ?? []) {
    for (const row of course.assignments ?? []) {
      if (typeof row !== "object" || row === null) continue;
      const id = (row as Row).id;
      if (typeof id === "string" && id.toLowerCase() === assignmentId) return kindOfRow(row as Row);
    }
  }
  return "text";
}
