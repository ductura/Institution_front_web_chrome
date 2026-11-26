// WEB-V22-STUDOMAT-ULAZ (val22-razlika §3 t. 6): where the link from Studomat leads. The link carries nothing from
// Studomat; of the query only one optional `kolegij` (a UUID) is read, everything else is dropped, never forwarded.
import type { ShellRole } from "../../../../../../src/components/index.ts";

export const STUDOMAT_ENTRY_PATH = "/ulaz/studomat";

export type StudomatTarget =
  | { readonly kind: "sign-in"; readonly returnTo: string }
  | { readonly kind: "enroll"; readonly courseId: string }
  | { readonly kind: "home" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The course id of the query, lower-cased; null unless `kolegij` is given exactly once and is a UUID. */
export function courseOf(query: URLSearchParams): string | null {
  const given = query.getAll("kolegij");
  if (given.length !== 1) return null;
  const value = given[0] ?? "";
  return UUID.test(value) ? value.toLowerCase() : null;
}

/** Signed out: sign-in, back to this route (with the valid `kolegij` only). Student: the enrolment of that course, else home. Others: home. */
export function studomatTarget({ session, role, query }: { session: boolean; role: ShellRole | null; query: URLSearchParams }): StudomatTarget {
  const courseId = courseOf(query);
  if (!session) return { kind: "sign-in", returnTo: courseId === null ? STUDOMAT_ENTRY_PATH : `${STUDOMAT_ENTRY_PATH}?kolegij=${courseId}` };
  if (role === "student" && courseId !== null) return { kind: "enroll", courseId };
  return { kind: "home" };
}

/** The app route a target leads to (without the base); sign-in is left to the login route of the server. */
export function enrollRoute(courseId: string): string {
  return `/upis/kolegij/${courseId}`;
}
