import { navFor, type NavItem, type ShellRole } from "../../shell/nav";
import type { ShellAccess } from "../../shell/shell-access";

// WEB-17 (Ductus#2028 c.7008147932): the teacher's shell over the shared
// shell of WEB-08. The role comes from the server's session read (me), never
// from the browser; every teacher page still reads its own data under the
// session, and the server answers 403 to anyone else.

/** The teacher's home and the path the sign-in returns to. */
export const TEACHER_HOME = "/nastavnik";

/** What the teacher's shell shows for one session read. */
export type TeacherShellView =
  /** No session, or the server did not answer: the sign-in page decides which. */
  | { readonly kind: "signIn" }
  /** Signed in through AAI@EduHr without a role (A-5). */
  | { readonly kind: "noRole" }
  /** Signed in with another role: that role's shell and the way to its own home. */
  | { readonly kind: "otherRole"; readonly role: Exclude<ShellRole, "teacher">; readonly institution: string | null }
  | { readonly kind: "teacher"; readonly institution: string | null };

export function teacherShellView(access: ShellAccess): TeacherShellView {
  if (access.kind === "signedOut" || access.kind === "unavailable") return { kind: "signIn" };
  if (access.kind === "noRole") return { kind: "noRole" };
  if (access.role === "teacher") return { kind: "teacher", institution: access.institution };
  return { kind: "otherRole", role: access.role, institution: access.institution };
}

/**
 * The navigation item a teacher's path belongs to: the longest item href that
 * is the path itself or a parent of it, so /nastavnik/zbirni is "Zbirni
 * pregled" and not "Moji kolegiji". A trailing slash is ignored; none for a
 * path outside every item.
 */
export function currentTeacherItem(pathname: string, items: readonly NavItem[] = navFor("teacher")): NavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: NavItem | undefined;
  for (const item of items) {
    const inside = path === item.href || path.startsWith(`${item.href}/`);
    if (inside && (best === undefined || item.href.length > best.href.length)) best = item;
  }
  return best;
}
