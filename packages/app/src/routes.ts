// Routes of the institution front (#2028 c.6993786629 §1, §3.3): the base the
// app is served under, the page of a path for the signed-in role, and which
// links the app opens itself. Pure functions; src/host/Host.tsx does the effects.
import { HOW_IT_WORKS_HREF, homeHref, navFor, type ShellRole } from "../../../src/components/index.ts";
import { messagesHr as t } from "../../../locales/hr.ts";
import { consultationMessages } from "../../../src/components/teacher/consultation-records/messages.hr.ts";
import { n11Messages } from "./host/teacher/n11/messages.hr.ts";
import { interviewMessages } from "./host/teacher/interview/messages.hr.ts";
import { n10Messages } from "./host/teacher/n10/messages.hr.ts";
import { messagesHr as workText } from "../../../src/lib/i18n/messages.hr.ts";

import type { SessionRole } from "../../../src/client/api.ts";

import type { Base } from "./bases";
import { studentDataExportMessages } from "./host/institution/student-data-export/messages.hr";
import { studentDataDownloadMessages } from "./host/public/student-data-download/messages.hr";
import { publicVerificationHr } from "../../../src/components/public-verification/messages.hr.ts";
import { VERIFY_PATH } from "./host/public/verify/model";
import { courseStudentsMessages } from "./host/teacher/n04/messages.hr";
import { courseAggregateMessages } from "./host/teacher/course-aggregate/messages.hr";
import { merlinMessages } from "./host/teacher/merlin/messages.hr";
import { submissionsMessages } from "./host/teacher/submissions/messages.hr";
import { accessDeniedHr, profileHr } from "./i18n/messages.hr";
import { originText } from "./host/teacher/provenance/origin-messages.hr";
import { interviewMessages as studentInterviewText } from "./host/student/interview/messages.hr";
import { thresholdMessages } from "./host/institution/origin-thresholds/messages.hr";
import { pilotMetricsMessages } from "./host/operator/pilot-metrics/messages.hr";
import { hostText } from "./text";
import { reviewMessages } from "./host/teacher/work/review/messages.hr";

export { BASES, type Base } from "./bases";

/** /app/chrome for a path under it, /app/web for every other path. */
export function baseOf(pathname: string): Base {
  return pathname === "/app/chrome" || pathname.startsWith("/app/chrome/") ? "/app/chrome" : "/app/web";
}

/** The app's own path: the pathname without its base and without a trailing slash; "/" for the base itself. */
export function routeOf(pathname: string, base: Base): string {
  const rest = pathname === base || pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
  const trimmed = rest.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The shell's role for a session role; an account kind without a space of its own has none. */
export function shellRole(role: SessionRole | null): ShellRole | null {
  if (role === "institution_admin") return "admin";
  if (role === "teacher" || role === "student") return role;
  return null;
}

export type PageKind = "studentHome" | "studentCourses" | "teacherCourses" | "mentoredWorks" | "pending";
export type Page = {
  /** The route; a segment in brackets ("/zadatak/[id]") is any one segment, as in app/[base]/. */
  readonly path: string;
  readonly label: string;
  readonly kind: PageKind;
  /** Roles that may open it; empty: everyone signed in. */
  readonly roles: readonly ShellRole[];
  /** The navigation item it marks as current, if any. */
  readonly current?: string;
  /** Opened without reading the session and outside the shell, as Ductus /stanje and /prijava. */
  readonly public?: boolean;
  /**
   * Account kinds that alone may open it, whatever their shell role (NF-7 OA-1: the operator has
   * none); `roles` is then not read. Every other account is refused (NO_ACCESS), not led home.
   */
  readonly accounts?: readonly SessionRole[];
};

/** NF-7 OA-1: the operator's own page, the pilot's aggregate measures; the operator's home. */
export const OPERATOR_HOME = "/operater/mjerila-pilota";
/** M1.8: where a refused page leads, with the refusal ("Nemate ovlasti za ovaj prikaz"). */
export const NO_ACCESS = "/nema-ovlasti?kind=denied";

/** Whether a route is a page's path: the same segments, a bracketed one standing for any. */
export function pathMatches(path: string, route: string): boolean {
  const want = path.split("/");
  const have = route.split("/");
  return want.length === have.length && want.every((w, i) => (/^\[\w+\]$/.test(w) ? (have[i] ?? "") !== "" : w === have[i]));
}

/** In the administrator's navigation, but open to every signed-in account (the registry office has no role); listed once below. */
const STUDENT_DATA_EXPORT_PATH = "/ustanova/izvoz-podataka";
const ROLES: readonly ShellRole[] = ["student", "teacher", "admin"];
const KINDS: Readonly<Record<string, PageKind>> = {
  "/zadaci": "studentHome",
  "/zadaci/kolegiji": "studentCourses",
  "/nastavnik": "teacherCourses",
  "/nastavnik/mentorstva": "mentoredWorks",
};

/**
 * Every page: the navigation of each role (nav.ts), the pages of Ductus app/
 * reached from it, and "Kako Ductura radi" for everyone.
 */
export const PAGES: readonly Page[] = [
  ...ROLES.flatMap((role) => navFor(role).filter((item) => item.href !== STUDENT_DATA_EXPORT_PATH).map((item) => ({
    path: item.href, label: item.label, kind: KINDS[item.href] ?? "pending", roles: [role], current: item.href,
  }))),
  { path: "/zadatak/[id]", label: t.student.title, kind: "pending", roles: ["student", "teacher"] },
  { path: "/upis/kolegij/[courseId]", label: t.student.enroll.title, kind: "pending", roles: ["student"], current: "/upis" },
  // WEB-1404: the student's request for a mentor.
  { path: "/zadaci/mentorstvo", label: hostText.mentorshipRequest, kind: "pending", roles: ["student"], current: "/zadaci" },
  // HOST-S1: the editor of one work.
  { path: "/rad/[assignmentId]", label: t.workspace.title, kind: "pending", roles: ["student"], current: "/rad" },
  { path: "/rad/[assignmentId]/predaja", label: t.submission.title, kind: "pending", roles: ["student"] },
  // HOST-S2: the steps of the submission (WEB-24..27).
  { path: "/rad/[assignmentId]/predaja/izjava", label: workText.declaration.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/pregled", label: workText.beforeSubmit.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/slanje", label: workText.submit.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/potvrda", label: workText.receipt.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/dnevnik-pristupa", label: t.accessLog.context, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/reprodukcija", label: t.replay.titleStudent, kind: "pending", roles: ["student"] },
  // PIL-P1-SASTAV-STUDENT: the student sees the same composition as the teacher (P-1 rule 2.2).
  { path: "/rad/[assignmentId]/podrijetlo", label: originText.title, kind: "pending", roles: ["student"] },
  // PIL-K-RAZGOVOR: the student's side of the teacher's interview preparation (N-14, WEB-1531).
  { path: "/rad/[assignmentId]/razgovor", label: studentInterviewText.pageTitle, kind: "pending", roles: ["student"] },
  { path: "/nastavnik/kolegiji", label: t.teacherCourses.title, kind: "teacherCourses", roles: ["teacher"], current: "/nastavnik" },
  // WEB-2143: N-04 "Popis studenata", reached from the course card (N-01).
  { path: "/nastavnik/kolegiji/[courseId]/studenti", label: courseStudentsMessages.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  // PIL-K-ZBIRNO: the course aggregate (N-17), reached from the course roster (N-04).
  { path: "/nastavnik/kolegiji/[courseId]/zbirno", label: courseAggregateMessages.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/rad/[id]", label: t.liveView.context, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/reprodukcija", label: t.replay.titleTeacher, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/predaja", label: workText.receipt.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/usporedba", label: n11Messages.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/sazetak", label: n10Messages.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/priprema-razgovora", label: interviewMessages.title, kind: "pending", roles: ["teacher"] },
  // WEB-NUZ-PG (NF-5 PG-1): one review of the work, reached from the work's views.
  { path: "/nastavnik/rad/[id]/pregled", label: reviewMessages.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/konzultacije", label: consultationMessages.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/zadatak/novi", label: t.teacher.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/zadatak/[assignmentId]/uredi", label: t.teacher.newVersion.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/zadatak/[assignmentId]/rad/[documentId]/jezik", label: t.teacher.workLanguageException.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  // HOST-T3: N-13 "Produljenje roka" (WEB-1113), reached from the overview page (N-17).
  { path: "/nastavnik/zadatak/[assignmentId]/produljenje", label: hostText.deadlineExtensions, kind: "pending", roles: ["teacher"], current: "/nastavnik/zbirni" },
  // WEB-2163: N-18 "Izvoz za Merlin", reached from the course card (N-01).
  { path: "/nastavnik/zadatak/[assignmentId]/merlin", label: merlinMessages.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  // PIL-D2-PREDAJE: the submissions of one assignment (WEB-1502), reached from the course card (N-01).
  { path: "/nastavnik/zadatak/[assignmentId]/predaje", label: submissionsMessages.pageTitle, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: HOW_IT_WORKS_HREF, label: t.shell.howItWorks, kind: "pending", roles: [], current: HOW_IT_WORKS_HREF },
  // WEB-1804 (M11.5): interface language, name and notifications, for everyone signed in.
  { path: "/profil", label: profileHr.title, kind: "pending", roles: [] },
  // WEB-1302: the registry office requests a student's data export, the administrator starts it;
  // open to everyone signed in, since the registry office has no role of its own and the server decides.
  { path: STUDENT_DATA_EXPORT_PATH, label: studentDataExportMessages.title, kind: "pending", roles: [], current: STUDENT_DATA_EXPORT_PATH },
  // PIL-P1-PRAGOVI-ADMIN (P-1 rule 12): the faculty's thresholds per origin kind, next to the faculty rules.
  { path: "/ustanova/pragovi", label: thresholdMessages.title, kind: "pending", roles: ["admin"], current: "/ustanova/pravila" },
  // WEB-NUZ-OPERATER (NF-7 OA-1, OA-12): the operator's view of the institution, the pilot's aggregates only.
  { path: OPERATOR_HOME, label: pilotMetricsMessages.title, kind: "pending", roles: [], accounts: ["network_engineer"], current: OPERATOR_HOME },
  { path: "/stanje", label: t.statusPage.pageTitle, kind: "pending", roles: [], public: true },
  { path: "/prijava", label: hostText.signIn, kind: "pending", roles: [], public: true },
  // M1.8: 401/403 and an ended session; public, since an ended session cannot be read.
  { path: "/nema-ovlasti", label: accessDeniedHr.pageTitle, kind: "pending", roles: [], public: true },
  // WEB-1805 (M11.6, F-03): the accessibility statement; public, as the law asks.
  { path: "/pristupacnost", label: t.shell.accessibilityStatement, kind: "pending", roles: [], public: true },
  // WEB-1302: the student's one-time download; public, the token in the link is the only key.
  { path: "/izvoz-podataka/[token]", label: studentDataDownloadMessages.labels.title, kind: "pending", roles: [], public: true },
  // WEB-2111 (R-41, V-5, C-6): the check of a receipt; public, anyone holding the receipt checks it.
  { path: VERIFY_PATH, label: publicVerificationHr.title, kind: "pending", roles: [], public: true },
];

/** The public page of a route, or null when the route needs the session. */
export function publicPage(route: string): Page | null {
  return PAGES.find((p) => p.public === true && pathMatches(p.path, route)) ?? null;
}

export type Resolved =
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "page"; readonly page: Page }
  | { readonly kind: "noRole" }
  | { readonly kind: "notFound" };

/**
 * What a path shows to a role. "/" leads to the role's own home; a page of
 * another role leads there too, since the server would refuse its reads
 * anyway. Without a role only "Kako Ductura radi" and the plain home remain,
 * and for the operator (`accounts`, the session's account kinds) its own page.
 * A page kept for some account kinds refuses every other account.
 */
export function resolve(route: string, role: ShellRole | null, accounts: readonly SessionRole[] = []): Resolved {
  const home = homeHref(role);
  const operator = role === null && accounts.includes("network_engineer");
  if (route === "/") {
    if (operator) return { kind: "redirect", to: OPERATOR_HOME };
    return role === null ? { kind: "noRole" } : { kind: "redirect", to: home };
  }
  const page = PAGES.find((p) => pathMatches(p.path, route));
  if (page === undefined) return { kind: "notFound" };
  if (page.accounts !== undefined) {
    return page.accounts.some((kind) => accounts.includes(kind)) ? { kind: "page", page } : { kind: "redirect", to: NO_ACCESS };
  }
  if (page.roles.length === 0 || (role !== null && page.roles.includes(role))) return { kind: "page", page };
  return role === null ? { kind: "redirect", to: "/" } : { kind: "redirect", to: home };
}

/** Breadcrumb of a page: none on the role's own home, else the page's label. */
export function crumbsOf(page: Page, role: ShellRole | null): readonly string[] {
  return page.path === homeHref(role) ? [] : [page.label];
}

/**
 * The app path a link leads to when the app should open it itself, else null
 * (the browser follows it: another origin, the preloader's or the admin's
 * pages, the server). Links of the screens are written without the base
 * ("/zadaci"), the shell's with it ("/app/web/zadaci"); both open here.
 */
export function internalRoute(href: string, base: Base): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const path = href.split(/[?#]/, 1)[0] ?? "";
  if (path === base || path.startsWith(`${base}/`)) return `${routeOf(path, base)}${href.slice(path.length)}`;
  if (path === "/" || PAGES.some((p) => pathMatches(p.path, path))) return path;
  return null;
}
