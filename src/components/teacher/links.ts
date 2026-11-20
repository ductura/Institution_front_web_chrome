// The links TeacherCourses draws, ported from Ductus at 9c45857 (DAN-871,
// 871-1): newAssignmentHref from src/components/teacher/existing-course.ts,
// workLanguageExceptionHref with workSegments from
// src/components/teacher/work-language.ts, and isDocumentId from
// src/domain/collaboration/comment.ts as a private copy. The saves of
// work-language.ts call the network and are not ported.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_ID_MAX = 256;
// C0, DEL and C1, like [[:cntrl:]].
const CONTROL = /\p{Cc}/u;

function codePoints(value: string): number {
  return [...value].length;
}

/** Same shape as the evidence.document id CHECK. */
function isDocumentId(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value) return false;
  const length = codePoints(value);
  return length >= 1 && length <= DOCUMENT_ID_MAX && !CONTROL.test(value);
}

/** WEB-1113 (N-13): the page of deadline extensions for an assignment. */
export function extensionsHref(assignmentId: string): string {
  return `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`;
}

/** The link from /nastavnik to the form for a further assignment in `courseId`. */
export function newAssignmentHref(courseId: string): string {
  return `/nastavnik/zadatak/novi?kolegij=${encodeURIComponent(courseId)}`;
}

/**
 * DAN-386 (M2.10-P02d): the page for one work's language, keyed by the
 * assignment and the work's document id, never the student's id; null for
 * ids the page could not read anyway. "." and ".." are refused too: the
 * browser would resolve them as path steps, not as the work's segment.
 */
export function workLanguageExceptionHref(assignmentId: unknown, documentId: unknown): string | null {
  const work = workSegments(assignmentId, documentId);
  return work === null ? null : `/nastavnik/zadatak/${work[0]}/rad/${work[1]}/jezik`;
}

/** The assignment and the encoded document id as path segments, or null for ids no route could read. */
function workSegments(assignmentId: unknown, documentId: unknown): [string, string] | null {
  if (typeof assignmentId !== "string" || !UUID.test(assignmentId) || !isDocumentId(documentId)
    || documentId === "." || documentId === "..") return null;
  return [assignmentId.toLowerCase(), encodeURIComponent(documentId)];
}
