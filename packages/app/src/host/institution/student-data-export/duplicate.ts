/**
 * NF-7 OA-6: no second request for the same student from this page. The list of
 * institution.student-data-exports.get does not say whose each request is, so the page remembers
 * the students it has sent a request for, or been told already have an open one (409), and
 * refuses a second one before sending it. The server's 409 stays the authority for everyone else.
 */
export type OpenRequests = { readonly has: (studentId: string) => boolean; readonly add: (studentId: string) => void };

/** The student's mark as the server compares it: a UUID, in either case. */
const keyOf = (studentId: string): string => studentId.trim().toLowerCase();

export function openRequests(): OpenRequests {
  const seen = new Set<string>();
  return { has: (studentId) => seen.has(keyOf(studentId)), add: (studentId) => { seen.add(keyOf(studentId)); } };
}
