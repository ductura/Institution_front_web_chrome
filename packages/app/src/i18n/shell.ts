import { navFor, type ShellRole } from "../../../../src/components/index.ts";

import type { Page } from "../routes";
import type { Catalogues } from "./catalogue";

type Label = (c: Catalogues) => string;

/** Pages outside the navigation whose label is a catalogue text, by path (the same texts as PAGES in routes.ts). */
const LABELS: Readonly<Record<string, Label>> = {
  "/zadatak/[id]": (c) => c.t.student.title,
  "/upis/kolegij/[courseId]": (c) => c.t.student.enroll.title,
  "/rad/[assignmentId]": (c) => c.t.workspace.title,
  "/rad/[assignmentId]/predaja": (c) => c.t.submission.title,
  "/rad/[assignmentId]/predaja/izjava": (c) => c.work.declaration.title,
  "/rad/[assignmentId]/predaja/pregled": (c) => c.work.beforeSubmit.title,
  "/rad/[assignmentId]/predaja/slanje": (c) => c.work.submit.title,
  "/rad/[assignmentId]/predaja/potvrda": (c) => c.work.receipt.title,
  "/rad/[assignmentId]/dnevnik-pristupa": (c) => c.t.accessLog.context,
  "/rad/[assignmentId]/reprodukcija": (c) => c.t.replay.titleStudent,
  "/nastavnik/kolegiji": (c) => c.t.teacherCourses.title,
  "/nastavnik/rad/[id]": (c) => c.t.liveView.context,
  "/nastavnik/rad/[id]/reprodukcija": (c) => c.t.replay.titleTeacher,
  "/nastavnik/rad/[id]/predaja": (c) => c.work.receipt.title,
  "/nastavnik/rad/[id]/konzultacije": (c) => c.app.pages.consultations,
  "/nastavnik/zadatak/novi": (c) => c.t.teacher.title,
  "/nastavnik/zadatak/[assignmentId]/uredi": (c) => c.t.teacher.newVersion.title,
  "/nastavnik/zadatak/[assignmentId]/rad/[documentId]/jezik": (c) => c.t.teacher.workLanguageException.title,
  "/nastavnik/zadatak/[assignmentId]/produljenje": (c) => c.app.host.deadlineExtensions,
  "/zadaci/mentorstvo": (c) => c.app.host.mentorshipRequest,
  "/kako-radi": (c) => c.t.shell.howItWorks,
  "/stanje": (c) => c.t.statusPage.pageTitle,
  "/prijava": (c) => c.app.host.signIn,
  "/nema-ovlasti": (c) => c.app.accessDenied.pageTitle,
  "/profil": (c) => c.app.profile.title,
  "/pristupacnost": (c) => c.t.shell.accessibilityStatement,
};

/**
 * The label of a page in the current interface language: the navigation's
 * own label, a catalogue text for the pages above, else the page's label as
 * written in routes.ts.
 */
export function navLabel(page: Page, role: ShellRole | null, c: Catalogues): string {
  const item = navFor(role, c.t).find((i) => page.path === i.href);
  if (item !== undefined) return item.label;
  return LABELS[page.path]?.(c) ?? page.label;
}
