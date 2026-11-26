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
  "/rad/[assignmentId]/podrijetlo": (c) => c.app.pages.originComposition,
  "/rad/[assignmentId]/razgovor": (c) => c.app.pages.studentInterview,
  "/nastavnik/kolegiji": (c) => c.t.teacherCourses.title,
  "/nastavnik/kolegiji/[courseId]/studenti": (c) => c.app.pages.courseStudents,
  "/nastavnik/kolegiji/[courseId]/zbirno": (c) => c.app.pages.courseAggregate,
  "/nastavnik/rad/[id]": (c) => c.t.liveView.context,
  "/nastavnik/rad/[id]/reprodukcija": (c) => c.t.replay.titleTeacher,
  "/nastavnik/rad/[id]/predaja": (c) => c.work.receipt.title,
  "/nastavnik/rad/[id]/konzultacije": (c) => c.app.pages.consultations,
  "/nastavnik/rad/[id]/usporedba": (c) => c.app.pages.versionComparison,
  "/nastavnik/rad/[id]/sazetak": (c) => c.app.pages.processSummary,
  "/nastavnik/rad/[id]/priprema-razgovora": (c) => c.app.pages.interviewPreparation,
  "/nastavnik/rad/[id]/pregled": (c) => c.app.pages.workReview,
  "/nastavnik/zadatak/novi": (c) => c.t.teacher.title,
  "/nastavnik/zadatak/[assignmentId]/uredi": (c) => c.t.teacher.newVersion.title,
  "/nastavnik/zadatak/[assignmentId]/rad/[documentId]/jezik": (c) => c.t.teacher.workLanguageException.title,
  "/nastavnik/zadatak/[assignmentId]/produljenje": (c) => c.app.host.deadlineExtensions,
  "/nastavnik/zadatak/[assignmentId]/merlin": (c) => c.app.pages.merlinExport,
  "/nastavnik/zadatak/[assignmentId]/predaje": (c) => c.app.pages.assignmentSubmissions,
  "/zadaci/mentorstvo": (c) => c.app.host.mentorshipRequest,
  "/zadaci/dnevnik-prakse": (c) => c.app.host.practiceJournal,
  "/zadaci/gradivo-kodiranja": (c) => c.app.host.qualMaterials,
  "/zadaci/upitnici": (c) => c.app.host.questionnaires,
  "/zadaci/kodiranje-izvoz": (c) => c.app.host.qualExport,
  "/zadaci/kodiranje": (c) => c.app.host.qualCoding,
  "/nastavnik/upitnici/[questionnaireId]/izvoz": (c) => c.app.host.questionnaireExport,
  "/nastavnik/mentorstva/dnevnik-prakse": (c) => c.app.host.mentorPracticeJournal,
  "/zadatak/[id]/tim": (c) => c.app.host.workTeam,
  "/nastavnik/zadatak/[assignmentId]/timovi": (c) => c.app.host.workTeams,
  "/nastavnik/zadatak/[assignmentId]/recenzija": (c) => c.app.host.teacherPeerReview,
  "/nastavnik/zadatak/[assignmentId]/testovi": (c) => c.app.host.teacherCodeTests,
  "/zadatak/[id]/recenzija": (c) => c.app.host.peerReview,
  "/zadatak/[id]/recenzija/primljene": (c) => c.app.host.peerReviewReceived,
  "/zadatak/[id]/recenzija/rad/[taskId]": (c) => c.app.host.peerReviewWork,
  "/kako-radi": (c) => c.t.shell.howItWorks,
  "/stanje": (c) => c.t.statusPage.pageTitle,
  "/prijava": (c) => c.app.host.signIn,
  "/nema-ovlasti": (c) => c.app.accessDenied.pageTitle,
  "/profil": (c) => c.app.profile.title,
  "/pristupacnost": (c) => c.t.shell.accessibilityStatement,
  "/o-aplikaciji": (c) => c.t.landing.demo.pageTitle,
  "/ustanova/izvoz-podataka": (c) => c.app.pages.studentDataExport,
  "/izvoz-podataka/[token]": (c) => c.app.pages.studentDataDownload,
  "/provjera": (c) => c.app.pages.receiptCheck,
  "/ustanova/pragovi": (c) => c.app.pages.originThresholds,
  "/ustanova/postavke": (c) => c.app.pages.facultySettings,
  "/ustanova/postavke/asistent": (c) => c.app.pages.facultyAssistant,
  "/ustanova/etape": (c) => c.app.pages.milestoneTemplate,
  "/ustanova/zavrsni-radovi": (c) => c.app.pages.thesisOverview,
  "/ustanova/predlozak-rada": (c) => c.app.pages.workTemplate,
  "/moja-prava": (c) => c.app.pages.myRights,
  "/ustanova/isvu": (c) => c.app.pages.isvuImport,
  "/nastavnik/kolegiji/[courseId]/isvu-ocjene": (c) => c.app.pages.isvuGrades,
  "/analiza": (c) => c.app.pages.analysis,
  "/ulaz/studomat": (c) => c.app.pages.studomatEntry,
  "/operater/mjerila-pilota": (c) => c.app.pages.pilotMetrics,
  "/operater/dnevnik-radnji": (c) => c.app.pages.actionLog,
  "/operater/prijave-problema": (c) => c.app.pages.problemReports,
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
