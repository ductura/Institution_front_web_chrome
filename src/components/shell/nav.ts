import { messagesHr, type Messages } from "../../../locales/hr.ts";

/**
 * The side navigation of the design v3 shell (#476 6314969336, I3): which
 * items a role sees. The role is the one the server read for the page; the
 * browser never chooses it. Only routes that exist are listed, so no item
 * leads to a 404 (a unit test checks every href against `app/`).
 */
export type ShellRole = "teacher" | "student" | "admin";

export type NavItem = {
  href: string;
  label: string;
};

// The labels come from the catalogue of the interface language (D-70, WEB-1804); Croatian by default.
const nav = (t: Messages): Record<ShellRole, readonly NavItem[]> => ({
  teacher: [
    // DAN-1082: three places. "Novi kolegij i zadatak" is an action, not a
    // place: it is the button on "Moji kolegiji" (TeacherCourses), not an item.
    { href: "/nastavnik", label: t.shell.nav.courses },
    { href: "/nastavnik/brz-put", label: t.shell.nav.fastPath },
    // DAN-492 (N-16): the works the teacher mentors (DAN-477).
    { href: "/nastavnik/mentorstva", label: t.shell.nav.mentoredWorks },
    // WEB-17 (A-9, owner 19. 11. 2026., #2028 c.6997707653): "Zbirni" joins
    // the teacher's navigation; N-17 shows its empty state until its read.
    { href: "/nastavnik/zbirni", label: t.shell.nav.summary },
  ],
  student: [
    { href: "/zadaci", label: t.shell.nav.assignments },
    // DAN-344 (Archivum S02): the student's own courses, from the same read as /zadaci.
    { href: "/zadaci/kolegiji", label: t.shell.nav.courses },
    // DAN-309 (B2): the student's own works across courses, from app.student_workspace().
    { href: "/zadaci/radovi", label: t.shell.nav.works },
    { href: "/rad", label: t.shell.nav.workspace },
    { href: "/upis", label: t.shell.nav.enroll },
    // F4-V18-22-R01: screens that were reached only by typing the path.
    { href: "/zadaci/upitnici", label: t.shell.nav.questionnaires },
    { href: "/zadaci/gradivo-kodiranja", label: t.shell.nav.codingMaterials },
    { href: "/zadaci/kodiranje-izvoz", label: t.shell.nav.codingExport },
    { href: "/zadaci/dnevnik-prakse", label: t.shell.nav.practiceJournal },
  ],
  // DAN-313 (A-01): the administrator's overview of their own institution.
  admin: [
    { href: "/ustanova", label: t.shell.nav.institution },
    // DAN-581 (A-02): the administrator confirms and revokes the teacher role.
    { href: "/ustanova/korisnici", label: t.shell.nav.users },
    // DAN-591 (A-03): the courses, teams and groups by academic year, read only.
    { href: "/ustanova/kolegiji", label: t.shell.nav.institutionCourses },
    // DAN-590 (A-04): the faculty rule versions, read only.
    { href: "/ustanova/pravila", label: t.shell.nav.facultyRules },
    // WEB-1301 (A-05): the data classes and the legal holds.
    { href: "/ustanova/cuvanje", label: t.shell.nav.dataRetention },
    // WEB-1302 (SRV-1308): the registry office's requests, started by the administrator.
    { href: "/ustanova/izvoz-podataka", label: t.shell.nav.studentDataExport },
    // F4-V18-22-R01 (V22-08): the ISVU connection, until now reached only by its path.
    { href: "/ustanova/isvu", label: t.shell.nav.isvu },
  ],
});

/** The items of `role`; none without a role (signed out, or neither role). Labels in the language of `t`. */
export function navFor(role: ShellRole | null, t: Messages = messagesHr): readonly NavItem[] {
  return role === null ? [] : nav(t)[role];
}

export type AccountPlace = "own" | "signOut" | "none";

/**
 * What the shell's account place holds (#802 part B): the page's own control
 * when it brings one, else the sign-out for anyone with a scope (a signed-in
 * person, with or without a role read for the page), else nothing.
 */
export function accountPlace(scope: string | null, ownAccount: boolean): AccountPlace {
  if (ownAccount) return "own";
  return scope !== null ? "signOut" : "none";
}

/**
 * Whether the side bar offers "Prijavi problem" (Z-10, DAN-431): for every
 * signed-in person, also where the page brings its own account control (the
 * workspace's LocalLogout), so a student need not leave the editor to report.
 */
export function offersProblemReport(scope: string | null): boolean {
  return scope !== null;
}

/**
 * Where "Početna" and the brand lead (#802 part B, D-202 t. 2): each role's
 * own home, the general home without a role. A student's home is S01 on
 * /zadaci (D-180), never the workspace; a teacher, also as a mentor (D-204),
 * goes to /nastavnik. Like the role itself, it only points the
 * way; every page still checks the session on its own.
 */
export function homeHref(role: ShellRole | null): string {
  if (role === "teacher") return "/nastavnik";
  if (role === "student") return "/zadaci";
  if (role === "admin") return "/ustanova";
  return "/";
}

/**
 * "Kako Ductura radi" (DAN-431, J-02): one static page for every reader, so
 * the shell links it for everyone, with or without a role.
 */
export const HOW_IT_WORKS_HREF = "/kako-radi";

/**
 * A path of the app under `base`, the prefix the app is served under (/app/web
 * or /app/chrome, #2028 c.6993786629 §1): "/" is the base itself. An empty
 * base leaves the path as it is.
 */
export function appHref(base: string, path: string): string {
  if (base === "") return path;
  return path === "/" ? `${base}/` : `${base}${path}`;
}
