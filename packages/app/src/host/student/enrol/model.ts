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
