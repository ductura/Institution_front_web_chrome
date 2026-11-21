/** WEB-1114 (N-18): the page "Izvoz za Merlin" of an assignment. */
export function merlinHref(assignmentId: string): string {
  return `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/merlin`;
}
