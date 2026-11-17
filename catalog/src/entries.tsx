import { Button, Card, SaveState, TextField } from "@ductura/ui";
import { useState } from "react";

import { messagesHr as t } from "../../locales/hr.ts";
import {
  AppShell, EmptyHome, ErrorScreen, MentoredWorks, MyAssignments, OutlinePanel, RouteLoading, StudentHome, TeacherCourses,
  type AssignmentSubmission, type MentoredWork, type MyCourse, type OutlineRow, type TeacherCourse,
} from "../../src/components/index.ts";

import type { CatalogEntries, CatalogState } from "./coverage";

type Entry = Record<CatalogState, () => React.ReactNode>;

// Invented example text only; no real people or student work.
export const ENTRIES = {
  Button: {
    prazno: () => <Button tone="quiet">Odustani</Button>,
    učitavanje: () => <Button busy>Spremanje…</Button>,
    greška: () => <Button tone="quiet">Pokušajte ponovno</Button>,
    puno: () => <Button>Predaj rad</Button>,
    onemogućeno: () => <Button disabled>Predaj rad</Button>,
  },
  TextField: {
    prazno: () => <TextField label="Naslov rada" placeholder="Npr. Javne politike u lokalnoj zajednici" />,
    učitavanje: () => <TextField label="Naslov rada" busy defaultValue="" hint="Učitavanje…" />,
    greška: () => <TextField label="Naslov rada" defaultValue="" error="Upišite naslov rada." />,
    puno: () => <TextField label="Naslov rada" defaultValue="Javne politike u lokalnoj zajednici" hint="Najviše 120 znakova." />,
    onemogućeno: () => <TextField label="Naslov rada" disabled defaultValue="Javne politike u lokalnoj zajednici" />,
  },
  SaveState: {
    prazno: () => <SaveState state="EDITING" />,
    učitavanje: () => <><SaveState state="SAVING_LOCAL" /><SaveState state="SYNCING" /></>,
    greška: () => <><SaveState state="CONFLICT" /><SaveState state="ERROR" /><SaveState state="RECOVERY_REQUIRED" /></>,
    puno: () => <><SaveState state="LOCAL_DURABLE" /><SaveState state="SYNCED" /></>,
    onemogućeno: () => <SaveState state="EDITING" blocked />,
  },
  Card: {
    prazno: () => <Card title="Moji radovi" empty="Još nema radova." />,
    učitavanje: () => <Card title="Moji radovi" busy />,
    greška: () => <Card title="Moji radovi" error="Popis se nije učitao. Pokušajte ponovno." />,
    puno: () => <Card title="Seminarski rad"><p>Uvod u temu i plan poglavlja.</p></Card>,
    onemogućeno: () => <Card title="Moji radovi" disabled><p>Zadatak je zatvoren.</p></Card>,
  },
} satisfies Record<string, Entry> satisfies CatalogEntries;

// The web's own components (src/components, DAN-753), texts from locales/ only.
const SCOPE = "c2NvcGUtb2YtYW4taW52ZW50ZWQtcGVyc29u";
const work = [t.shell.nav.assignments];
const page = <p>{t.home.workBody}</p>;
// Invented courses and assignments only (as in StudentHome.test.ts). Sign-in is
// the preloader's; the catalogue only shows where the link would lead.
const signIn = (returnTo: string) => `/prijava?returnTo=${encodeURIComponent(returnTo)}`;
const courses: MyCourse[] = [
  {
    id: "00000000-0000-4000-8000-00000000000a",
    name: "Izmišljeni kolegij A",
    assignments: [
      { id: "10000000-0000-4000-8000-000000000001", title: "Izmišljeni esej", dueAt: "2026-11-30T22:59:00.000Z", noticeFirst: false },
      { id: "10000000-0000-4000-8000-000000000002", title: "Izmišljeni prikaz", dueAt: "2026-12-05T22:59:00.000Z", noticeFirst: true },
    ],
  },
  { id: "00000000-0000-4000-8000-00000000000b", name: "Izmišljeni kolegij B", assignments: [] },
];

// Invented headings (DAN-977); the long title is one unbroken word, so wrapping is tested.
let at = 0;
const heading = (level: number, text: string, number: string | null): OutlineRow =>
  ({ entry: { id: `izmisljeni-${(at += 1)}`, level, text, pos: at * 10 }, number });
const outline = [
  heading(1, "Uvod", "1"), heading(2, "Izmišljeni pojmovi", "1.1"), heading(3, "Izmišljeni pojam", "1.1.1"),
  heading(1, "Metoda", "2"), heading(2, "Izmišljeni uzorak", "2.1"),
  heading(3, "Izmišljenanajduljariječkojaseprotežepredalekoiznadširinepanelaipokazujelomljenjenaslovaugranicamaćelije", "2.1.3"),
];

/**
 * Test rig of the catalogue, not of the component (978-3): logs every
 * "Samo naslovi" report on one wrapper that never changes, so e2e can see
 * that the panel reports each press exactly once.
 */
function HeadingsProbe() {
  const [log, setLog] = useState<readonly boolean[]>([]);
  // 979-2: the browser's localStorage, read here and not at module load (states.test renders this in node).
  const [store] = useState(() => {
    try {
      return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  });
  return (
    <div data-headings-log={log.join(",")}>
      <OutlinePanel rows={outline} active={2} store={store} scope="izmisljeni-dokument"
        onHeadingsOnlyChange={(on) => setLog((prev) => [...prev, on])} />
    </div>
  );
}

// Invented teacher courses (as in TeacherCourses.test.ts); each state has its own
// ids, so no heading id repeats on the page (DAN-871).
const teacherCourses = (n: number): TeacherCourse[] => [
  {
    id: `20000000-0000-4000-8000-00000000${n}0c1`, name: "Izmišljeni kolegij C", academicYear: "2026/2027", aiPolicy: "partially_allowed",
    assignments: [
      { id: `30000000-0000-4000-8000-00000000${n}0a1`, title: "Izmišljeni seminar", workType: "seminar_paper", opensAt: "2026-10-01T07:00:00.000Z", dueAt: "2026-11-30T22:59:00.000Z", currentVersion: 1, enrolledStudents: 12 },
      { id: `30000000-0000-4000-8000-00000000${n}0a2`, title: "Izmišljeni esej", workType: "essay", opensAt: "2026-10-01T07:00:00.000Z", dueAt: "2026-12-14T22:59:00.000Z", currentVersion: 2, enrolledStudents: 1 },
    ],
  },
  { id: `20000000-0000-4000-8000-00000000${n}0c2`, name: "Izmišljeni kolegij D", academicYear: "2025/2026", aiPolicy: "prohibited", assignments: [] },
];
const submission = (n: number, documentId: string | null, afterDeadline?: boolean): AssignmentSubmission => ({
  studentId: `40000000-0000-4000-8000-0000000000e${n}`, documentId, submitted: afterDeadline !== undefined,
  revision: afterDeadline === undefined ? null : 3, requestedMinute: afterDeadline === undefined ? null : "2026-11-30T21:00:00.000Z",
  afterDeadline: afterDeadline ?? null,
});
const teacherWorks = (n: number, works: AssignmentSubmission[] | null) => ({ [`30000000-0000-4000-8000-00000000${n}0a1`]: works });

// Invented mentored works (as in MentoredWorks.test.ts); the list orders them itself (DAN-871).
const mentored = (n: number, student: MentoredWork["student"], over: Partial<MentoredWork> = {}): MentoredWork => ({
  mentorshipId: `50000000-0000-4000-8000-0000000000${n}1`, assignmentId: `60000000-0000-4000-8000-0000000000${n}1`,
  documentId: `izmisljeni-rad-${n}`, student, title: `Izmišljeni naslov ${n}`, workType: "bachelor_thesis", workState: "in_progress", ...over,
});
const mentoredWorks = [
  mentored(1, { givenName: "Vesna", familyName: "Žbunić" }),
  mentored(2, { givenName: "Ante", familyName: "Čvorić" }, { workState: "submitted", workType: "master_thesis" }),
  mentored(3, { givenName: "Borna", familyName: "Crtić" }, {
    title: "Izmišljeninaslovbezrazmakakojijeduljiodretkaipokazujedaselomiunutarćelijenasvakojširini",
  }),
  mentored(4, { givenName: "Ana", familyName: "Izmišljenić" }, { documentId: null, workState: "not_started" }),
];

export const SCREEN_ENTRIES = {
  AppShell: {
    prazno: () => <AppShell navId="bocna-navigacija-1" role={null} scope={null} crumbs={[]} ownMain>{page}</AppShell>,
    učitavanje: () => <AppShell navId="bocna-navigacija-2" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="status">{t.student.loading}</p></AppShell>,
    greška: () => <AppShell navId="bocna-navigacija-3" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="alert">{t.errorPage.errorBody}</p></AppShell>,
    puno: () => <AppShell navId="bocna-navigacija-4" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain>{page}</AppShell>,
    onemogućeno: () => <AppShell navId="bocna-navigacija-5" role={null} scope={SCOPE} crumbs={[]} ownMain>{page}</AppShell>,
  },
  ErrorScreen: {
    prazno: () => <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    učitavanje: () => <RouteLoading label={t.student.loading} />,
    greška: () => <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={() => {}} />,
    puno: () => <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    onemogućeno: () => <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} />,
  },
  RouteLoading: {
    prazno: () => <RouteLoading label={t.workspace.panelLoading} />,
    učitavanje: () => <RouteLoading label={t.fastPath.loading} />,
    greška: () => <RouteLoading label={t.student.loading} />,
    puno: () => <RouteLoading label={t.workspace.statusLoading} />,
    onemogućeno: () => <RouteLoading label={t.workspace.panelLoading} />,
  },
  StudentHome: {
    prazno: () => <StudentHome read={{ kind: "ready", courses: [] }} enroll={null} signIn={signIn} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <StudentHome read={{ kind: "unavailable" }} enroll={null} signIn={signIn} />,
    puno: () => <StudentHome read={{ kind: "ready", courses }} enroll={null} signIn={signIn} />,
    onemogućeno: () => <StudentHome read={{ kind: "signedOut" }} enroll={null} signIn={signIn} />,
  },
  MyAssignments: {
    prazno: () => <MyAssignments courses={[{ ...courses[1]!, assignments: [] }]} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <StudentHome read={{ kind: "unavailable" }} enroll={null} signIn={signIn} view="courses" />,
    puno: () => <MyAssignments courses={courses} />,
    onemogućeno: () => <MyAssignments courses={courses} level={2} />,
  },
  EmptyHome: {
    prazno: () => <EmptyHome enroll={null} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <StudentHome read={{ kind: "unavailable" }} enroll={null} signIn={signIn} />,
    puno: () => <EmptyHome enroll={null} />,
    onemogućeno: () => <EmptyHome enroll={null} />,
  },
  OutlinePanel: {
    prazno: () => <OutlinePanel rows={[]} active={-1} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <OutlinePanel rows={[heading(0, "Nula", "0"), heading(1, "", "1"), heading(4, "Četiri", "1.0.0.1")]} active={-1} />,
    puno: () => <HeadingsProbe />,
    // No numbers; branch "2" collapsed (977-3), searched for "uzorak" (978-1): "2" and "2.1" show open,
    // and the active 2.1.3, not a hit, gives its mark to "2.1".
    onemogućeno: () => <OutlinePanel rows={outline.map((r) => ({ ...r, number: null }))} collapsed={[3]} active={5} query="uzorak" headingsOnly />,
  },
  TeacherCourses: {
    prazno: () => <TeacherCourses courses={[]} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <TeacherCourses courses={teacherCourses(3)} works={teacherWorks(3, null)} />,
    puno: () => (
      <TeacherCourses
        courses={teacherCourses(4)}
        works={teacherWorks(4, [submission(1, "izmisljeni-rad-1", false), submission(2, "izmisljeni-rad-2"), submission(3, "izmisljeni-rad-3", true)])}
        accommodations={{ "30000000-0000-4000-8000-0000000040a1": ["40000000-0000-4000-8000-0000000000e2"] }}
      />
    ),
    onemogućeno: () => <TeacherCourses courses={teacherCourses(5)} works={teacherWorks(5, [submission(1, null)])} />,
  },
  MentoredWorks: {
    prazno: () => <MentoredWorks works={[]} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <MentoredWorks works={[mentored(5, null, { documentId: null, workState: "not_started" })]} />,
    puno: () => <MentoredWorks works={mentoredWorks} />,
    onemogućeno: () => <MentoredWorks works={[mentored(6, { givenName: "Iva", familyName: "Izmišljenić" }, { documentId: null, workState: "not_started", workType: "doctoral_thesis" })]} />,
  },
} satisfies Record<string, Entry> satisfies CatalogEntries;
