// Routes of the institution front (#2028 c.6993786629 §1, §3.3): the base the
// app is served under, the page of a path for the signed-in role, and which
// links the app opens itself. Pure functions; src/host/Host.tsx does the effects.
import { HOW_IT_WORKS_HREF, homeHref, navFor, type ShellRole } from "../../../src/components/index.ts";
import { messagesHr as t } from "../../../locales/hr.ts";
import { consultationMessages } from "../../../src/components/teacher/consultation-records/messages.hr.ts";
import { messagesHr as workText } from "../../../src/lib/i18n/messages.hr.ts";

import type { SessionRole } from "../../../src/client/api.ts";

import type { Base } from "./bases";
import { hostText } from "./text";

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
};

/** Whether a route is a page's path: the same segments, a bracketed one standing for any. */
export function pathMatches(path: string, route: string): boolean {
  const want = path.split("/");
  const have = route.split("/");
  return want.length === have.length && want.every((w, i) => (/^\[\w+\]$/.test(w) ? (have[i] ?? "") !== "" : w === have[i]));
}

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
  ...ROLES.flatMap((role) => navFor(role).map((item) => ({
    path: item.href, label: item.label, kind: KINDS[item.href] ?? "pending", roles: [role], current: item.href,
  }))),
  { path: "/zadatak/[id]", label: t.student.title, kind: "pending", roles: ["student", "teacher"] },
  { path: "/upis/kolegij/[courseId]", label: t.student.enroll.title, kind: "pending", roles: ["student"], current: "/upis" },
  // HOST-S1: the editor of one work.
  { path: "/rad/[assignmentId]", label: t.workspace.title, kind: "pending", roles: ["student"], current: "/rad" },
  { path: "/rad/[assignmentId]/predaja", label: t.submission.title, kind: "pending", roles: ["student"] },
  // HOST-S2: the steps of the submission (WEB-24..27).
  { path: "/rad/[assignmentId]/predaja/izjava", label: t.declaration.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/pregled", label: t.beforeSubmit.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/slanje", label: t.submit.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/predaja/potvrda", label: t.receipt.title, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/dnevnik-pristupa", label: t.accessLog.context, kind: "pending", roles: ["student"] },
  { path: "/rad/[assignmentId]/reprodukcija", label: t.replay.titleStudent, kind: "pending", roles: ["student"] },
  { path: "/nastavnik/kolegiji", label: t.teacherCourses.title, kind: "teacherCourses", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/rad/[id]", label: t.liveView.context, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/reprodukcija", label: t.replay.titleTeacher, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/predaja", label: workText.receipt.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/rad/[id]/konzultacije", label: consultationMessages.title, kind: "pending", roles: ["teacher"] },
  { path: "/nastavnik/zadatak/novi", label: t.teacher.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/zadatak/[assignmentId]/uredi", label: t.teacher.newVersion.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  { path: "/nastavnik/zadatak/[assignmentId]/rad/[documentId]/jezik", label: t.teacher.workLanguageException.title, kind: "pending", roles: ["teacher"], current: "/nastavnik" },
  // HOST-T3: N-13 "Produljenje roka" (WEB-1113), reached from the overview page (N-17).
  { path: "/nastavnik/zadatak/[assignmentId]/produljenje", label: hostText.deadlineExtensions, kind: "pending", roles: ["teacher"], current: "/nastavnik/zbirni" },
  { path: HOW_IT_WORKS_HREF, label: t.shell.howItWorks, kind: "pending", roles: [], current: HOW_IT_WORKS_HREF },
  { path: "/stanje", label: t.statusPage.pageTitle, kind: "pending", roles: [], public: true },
  { path: "/prijava", label: hostText.signIn, kind: "pending", roles: [], public: true },
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
 * anyway. Without a role only "Kako Ductura radi" and the plain home remain.
 */
export function resolve(route: string, role: ShellRole | null): Resolved {
  const home = homeHref(role);
  if (route === "/") return role === null ? { kind: "noRole" } : { kind: "redirect", to: home };
  const page = PAGES.find((p) => pathMatches(p.path, route));
  if (page === undefined) return { kind: "notFound" };
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
