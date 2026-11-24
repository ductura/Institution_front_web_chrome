// NF-3 PR-10 (E-8c, R-64, INT-16): the choice of version made on step 3, so step 4 does not ask again.
// It is a convenience of this page's life, never a gate, and it is kept in memory only (not in the
// browser's storage): it holds which of the two INT-16 choices the student made for one confirmed
// revision of one document, and it is taken once. A choice for another revision, or none (a reload,
// another tab), is no choice, and step 4 asks as before.
import type { Confirmed, NewerChoice } from "./newer-local";

type Kept = { readonly assignmentId: string; readonly documentId: string; readonly revision: number; readonly choice: NewerChoice };

let kept: Kept | null = null;

/** Keeps the choice for this confirmed revision until step 4 takes it. */
export function rememberChoice(assignmentId: string, confirmed: Confirmed, choice: NewerChoice): void {
  kept = { assignmentId, documentId: confirmed.documentId, revision: confirmed.revision, choice };
}

/** The choice made for exactly this confirmed revision, once; null otherwise. */
export function takeChoice(assignmentId: string, confirmed: Confirmed): NewerChoice | null {
  const held = kept;
  kept = null;
  if (held === null) return null;
  const same = held.assignmentId === assignmentId && held.documentId === confirmed.documentId && held.revision === confirmed.revision;
  return same ? held.choice : null;
}
