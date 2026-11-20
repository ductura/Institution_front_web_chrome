import {
  Button, Card, Checkbox, DataTable, Details, Dialog, ErrorScreen, Fingerprint, Icon, ICON_NAMES, KeyValueList, PanelTabs,
  RouteLoading, SaveState, Select, Skeleton, StateTag, Steps, SUBMISSION_STATES, Tag, TextArea, TextField, ToastRegion,
  type DataTableColumn, type IconName,
} from "@ductura/ui";
import { useState } from "react";

import { messagesHr as t } from "../../locales/hr.ts";
import type { OverviewRow } from "../../src/client/teacher-reads";
import { BeforeSubmitView, type BeforeSubmitViewProps } from "../../src/components/predaja/BeforeSubmit.tsx";
import { DeclarationView, type DeclarationViewProps, type RecordedSummary } from "../../src/components/predaja/Declaration.tsx";
import type { SubmissionNote } from "../../src/client/submission.ts";
import { WorkspaceTopBarView } from "../../src/components/editor/WorkspaceTopBar.tsx";
import { MentorshipRequestsView } from "../../src/components/teacher/MentorshipRequests.tsx";
import type { ProcessSummaryV1 } from "../../src/components/summary/ProcessSummaryView.tsx";
import {
  AppShell, AssignmentOverview, CourseStudents, EmptyHome, LiveWorkFrame, MentoredWorks, MentorshipRequests, MyAssignments,
  NoteDialog, OutlinePanel, StudentHome, SubmitDialog, TeacherCourses,
  type AssignmentSubmission, type LiveWorkFrameData, type MentoredWork, type MyCourse, type OutlineRow, type RequestsRead,
  type TeacherCourse,
} from "../../src/components/index.ts";

import type { CatalogEntries, CatalogState } from "./coverage";

type Entry = Record<CatalogState, () => React.ReactNode>;

// Invented example text only; no real people or student work.
const GROUPS = [{ value: "a", label: "Grupa A" }, { value: "b", label: "Grupa B" }];
const SAMPLE_DIGEST = "0123456789abcdef".repeat(4);
const SAMPLE_WORKS = [{ title: "Izmišljeni seminar", pages: 12 }, { title: "Izmišljeni ogled", pages: 4 }];
const WORK_COLUMNS: DataTableColumn<(typeof SAMPLE_WORKS)[number]>[] = [
  { id: "title", header: "Rad", cell: (row) => row.title, rowHeader: true },
  { id: "pages", header: "Stranice", cell: (row) => row.pages, numeric: true, sortValue: (row) => row.pages },
];
const workTable = (caption: string, rows = SAMPLE_WORKS, loading = false) => (
  <DataTable caption={caption} rows={rows} columns={WORK_COLUMNS}
    rowKey={(row) => row.title} empty="Još nema radova." loading={loading} />
);
// The toast region is fixed to the viewport; in the catalogue it sits in the flow.
function ToastInline({ toasts }: { toasts: Parameters<typeof ToastRegion>[0]["toasts"] }) {
  return (
    <>
      <p>Obavijesti: {toasts.length}</p>
      <ToastRegion inline toasts={toasts} onDismiss={() => undefined} label="Obavijesti" closeLabel="Zatvori" />
    </>
  );
}
const ICON_LABELS: Record<IconName, string> = {
  undo: "Poništi", redo: "Ponovi", paragraph: "Odlomak", heading: "Naslov", bold: "Podebljano", italic: "Kurziv",
  bulletList: "Popis", quote: "Citat", chevronDown: "Više",
};
export const ENTRIES = {
  DataTable: {
    prazno: () => workTable("Radovi", []),
    učitavanje: () => workTable("Radovi", [], true),
    greška: () => <p role="alert">Radovi se nisu učitali.</p>,
    puno: () => workTable("Radovi"),
    onemogućeno: () => <p>Popis radova trenutačno nije dostupan.</p>,
  },
  Fingerprint: {
    prazno: () => <p>Još nema otiska potvrde.</p>,
    učitavanje: () => <RouteLoading label="Učitavanje otiska potvrde…" />,
    greška: () => <p role="alert">Otisak potvrde se nije učitao.</p>,
    puno: () => <Fingerprint value={SAMPLE_DIGEST} />,
    onemogućeno: () => <p>Otisak potvrde trenutačno nije dostupan.</p>,
  },
  KeyValueList: {
    prazno: () => <p>Još nema podataka o potvrdi.</p>,
    učitavanje: () => <RouteLoading label="Učitavanje podataka o potvrdi…" />,
    greška: () => <p role="alert">Podaci o potvrdi nisu se učitali.</p>,
    puno: () => <KeyValueList items={[
      { id: "submitted", label: "Vrijeme predaje", value: "20. 11. 2026. u 11:00",
        details: { summary: "Vrijeme u UTC-u", children: "2026-11-20T10:00:00Z" } },
    ]} />,
    onemogućeno: () => <p>Podaci o potvrdi trenutačno nisu dostupni.</p>,
  },
  StateTag: {
    prazno: () => <StateTag state="not_submitted" />,
    učitavanje: () => <StateTag state="pending" />,
    greška: () => <StateTag state="gap" />,
    puno: () => <>{SUBMISSION_STATES.map((state) => <StateTag key={state} state={state} />)}</>,
    onemogućeno: () => <p>Stanje predaje trenutačno nije dostupno.</p>,
  },
  Steps: {
    prazno: () => <Steps currentStep={1} />,
    učitavanje: () => <RouteLoading label="Učitavanje koraka predaje…" />,
    greška: () => <><Steps currentStep={3} /><p role="alert">Korak nije dovršen.</p></>,
    puno: () => <Steps currentStep={5} />,
    onemogućeno: () => <p>Koraci predaje trenutačno nisu dostupni.</p>,
  },
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
  // The toolbar icons (WEB-03) have no states of their own; each state shows
  // them in a button with its name, where one applies.
  Icon: {
    prazno: () => <Button tone="quiet"><Icon name="paragraph" /> Odlomak</Button>,
    učitavanje: () => <Button tone="quiet" busy><Icon name="undo" /> Poništi</Button>,
    greška: () => <Button tone="quiet"><Icon name="redo" /> Pokušajte ponovno</Button>,
    puno: () => <>{ICON_NAMES.map((name) => <span key={name}><Icon name={name} /> {ICON_LABELS[name]}</span>)}</>,
    onemogućeno: () => <Button tone="quiet" disabled><Icon name="bold" /> Podebljano</Button>,
  },
  // WEB-04: inline (modal={false}) so every state shows in the page flow.
  Dialog: {
    prazno: () => <Dialog open modal={false} title="Odjava" onClose={() => undefined}
      actions={<Button tone="quiet">Ostani</Button>}><p>Odjaviti se s ovog uređaja?</p></Dialog>,
    učitavanje: () => <Dialog open modal={false} title="Odjava" onClose={() => undefined} dismissible={false}
      actions={<Button busy>Odjavljivanje…</Button>}><p>Odjava je u tijeku.</p></Dialog>,
    greška: () => <Dialog open modal={false} title="Odjava" onClose={() => undefined}
      error="Odjava nije uspjela. Pokušajte ponovno." actions={<Button>Pokušajte ponovno</Button>}><p>Odjaviti se s ovog uređaja?</p></Dialog>,
    puno: () => <Dialog open modal={false} title="Odjava" onClose={() => undefined}
      actions={<><Button tone="quiet">Ostani</Button><Button>Odjavi se</Button></>}>
      <p>Rad je spremljen na poslužitelju. Nakon odjave na ovom uređaju ostaje samo ono što nije poslano.</p>
      <p>Ponovna prijava ide preko AAI@EduHr.</p></Dialog>,
    onemogućeno: () => <Dialog open modal={false} title="Odjava" onClose={() => undefined}
      actions={<Button disabled>Odjavi se</Button>}><p>Odjava trenutačno nije dostupna.</p></Dialog>,
  },
  ToastRegion: {
    prazno: () => <ToastInline toasts={[]} />,
    učitavanje: () => <ToastInline toasts={[{ id: 1, text: "Šaljem izmjene…", tone: "neutral" }]} />,
    greška: () => <ToastInline toasts={[{ id: 1, text: "Izmjena nije poslana. Pokušajte ponovno.", tone: "error" }]} />,
    puno: () => <ToastInline toasts={[1, 2, 3].map((id) => ({ id, text: `Komentar ${id} je dodan.`, tone: "neutral" as const }))} />,
    onemogućeno: () => <ToastInline toasts={[{ id: 1, text: "Obavijesti su isključene.", tone: "neutral" }]} />,
  },
  // WEB-05 form elements; invented course data only.
  Checkbox: {
    prazno: () => <Checkbox label="Pročitao sam obavijest o zadatku" />,
    učitavanje: () => <Checkbox label="Pročitao sam obavijest o zadatku" hint="Učitavanje…" aria-busy />,
    greška: () => <Checkbox label="Pročitao sam obavijest o zadatku" error="Potvrdite da ste pročitali obavijest." />,
    puno: () => <Checkbox label="Pročitao sam obavijest o zadatku" defaultChecked hint="Potvrđeno." />,
    onemogućeno: () => <Checkbox label="Pročitao sam obavijest o zadatku" disabled defaultChecked />,
  },
  Select: {
    prazno: () => <Select label="Grupa" placeholder="Odaberite grupu" options={GROUPS} />,
    učitavanje: () => <Select label="Grupa" placeholder="Odaberite grupu" options={[]} busy hint="Učitavanje…" />,
    greška: () => <Select label="Grupa" placeholder="Odaberite grupu" options={GROUPS} error="Odaberite grupu." />,
    puno: () => <Select label="Grupa" options={GROUPS} defaultValue="b" hint="Grupa B, utorkom." />,
    onemogućeno: () => <Select label="Grupa" options={GROUPS} defaultValue="a" disabled />,
  },
  TextArea: {
    prazno: () => <TextArea label="Napomena za studente" placeholder="Npr. Rad predajte do kraja tjedna" />,
    učitavanje: () => <TextArea label="Napomena za studente" busy hint="Učitavanje…" />,
    greška: () => <TextArea label="Napomena za studente" error="Napomena je preduga." defaultValue="Izmišljeni tekst napomene." />,
    puno: () => <TextArea label="Napomena za studente" defaultValue="Rad pišite u Ducturi; obavijest o zadatku vrijedi za cijelu grupu." hint="Najviše 500 znakova." />,
    onemogućeno: () => <TextArea label="Napomena za studente" disabled defaultValue="Zadatak je zatvoren." />,
  },
  Tag: {
    prazno: () => <Tag>Bez grupe</Tag>,
    učitavanje: () => <Tag>Učitavanje…</Tag>,
    greška: () => <Tag tone="warn">Rok je prošao</Tag>,
    puno: () => <><Tag>Grupa A</Tag> <Tag tone="accent">2026./2027.</Tag> <Tag tone="warn">Rok produljen</Tag></>,
    onemogućeno: () => <Tag>Zatvoreno</Tag>,
  },
  Skeleton: {
    prazno: () => <Skeleton label="Učitavanje…" lines={1} />,
    učitavanje: () => <Skeleton label="Učitavanje popisa zadataka…" />,
    greška: () => <><Skeleton label="Učitavanje…" lines={1} /><p>Popis se nije učitao. Pokušajte ponovno.</p></>,
    puno: () => <Skeleton label="Učitavanje rada…" lines={6} />,
    onemogućeno: () => <Skeleton label="Učitavanje zaustavljeno." lines={2} />,
  },
  Details: {
    prazno: () => <Details summary="Pravila zadatka"><p>Nastavnik još nije dodao pravila.</p></Details>,
    učitavanje: () => <Details summary="Pravila zadatka" open><p>Učitavanje…</p></Details>,
    greška: () => <Details summary="Pravila zadatka" open><p>Pravila se nisu učitala. Pokušajte ponovno.</p></Details>,
    puno: () => <Details summary="Pravila zadatka" open><p>Rad se piše u Ducturi. Nastavnik vidi rad dok nastaje.</p></Details>,
    onemogućeno: () => <Details summary="Pravila zadatka"><p>Zadatak je zatvoren.</p></Details>,
  },
  // WEB-06: moved from the web's shell; the web passes its own words.
  ErrorScreen: {
    prazno: () => <ErrorScreen retryLabel={t.auth.retry} homeLabel={t.auth.home} title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    učitavanje: () => <RouteLoading label={t.student.loading} />,
    greška: () => <ErrorScreen retryLabel={t.auth.retry} homeLabel={t.auth.home} title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={() => {}} />,
    puno: () => <ErrorScreen retryLabel={t.auth.retry} homeLabel={t.auth.home} title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    onemogućeno: () => <ErrorScreen retryLabel={t.auth.retry} homeLabel={t.auth.home} title={t.errorPage.errorTitle} body={t.errorPage.errorBody} />,
  },
  RouteLoading: {
    prazno: () => <RouteLoading label={t.workspace.panelLoading} />,
    učitavanje: () => <RouteLoading label={t.fastPath.loading} />,
    greška: () => <RouteLoading label={t.student.loading} />,
    puno: () => <RouteLoading label={t.workspace.statusLoading} />,
    onemogućeno: () => <RouteLoading label={t.workspace.panelLoading} />,
  },
  PanelTabs: {
    prazno: () => <PanelTabs label="Ploče" tabs={[{ id: "komentari", label: "Komentari", content: <p>Još nema komentara.</p> }]} />,
    učitavanje: () => <PanelTabs label="Ploče" tabs={[{ id: "komentari", label: "Komentari", content: <p>Učitavanje…</p> }]} />,
    greška: () => <PanelTabs label="Ploče" tabs={[{ id: "izvori", label: "Izvori", content: <p>Izvori se nisu učitali. Pokušajte ponovno.</p> }]} />,
    puno: () => <PanelTabs label="Ploče" initial="izvori" tabs={[
      { id: "komentari", label: "Komentari", content: <p>Dva komentara uz odlomak 2.</p> },
      { id: "izvori", label: "Izvori", content: <p>Tri izmišljena izvora.</p> },
      { id: "pravila", label: "Pravila", content: <p>Pravila zadatka.</p> },
    ]} />,
    onemogućeno: () => <PanelTabs label="Ploče" tabs={[{ id: "pravila", label: "Pravila", content: <p>Zadatak je zatvoren.</p> }]} />,
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

// Invented overview rows (as in AssignmentOverview.test.ts, WEB-33): submitted,
// after the deadline with a record gap, waiting for its receipt, and not submitted.
const overviewRow = (n: number, over: Partial<OverviewRow> = {}): OverviewRow => ({
  studentId: `70000000-0000-4000-8000-0000000000${n}1`, name: `Izmišljena Osoba ${n}`, group: "A",
  submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, ...over,
});
const overviewRows = [
  overviewRow(1, { submitted: true, requestedMinute: "2026-11-20T09:05Z", afterDeadline: true, evidenceRecord: "with_gaps" }),
  overviewRow(2),
  overviewRow(3, { group: "B", submitted: true, requestedMinute: "2026-11-02T13:32Z", evidenceRecord: "continuous" }),
  overviewRow(4, { submitted: true, requestedMinute: "2026-11-14T08:00Z" }),
];

// Invented live work frame (as in LiveWorkFrame.test.ts, WEB-34); the text slot holds an invented sentence.
const liveFrame = (over: Partial<LiveWorkFrameData> = {}): LiveWorkFrameData => ({
  studentName: "Vesna Žbunić", assignmentTitle: "Izmišljeni seminar: javne politike", submitted: false,
  previousId: "izmisljeni-rad-1", nextId: "izmisljeni-rad-3", ...over,
});
const liveText = <p>Izmišljena rečenica rada koja stoji umjesto teksta uživo.</p>;

// Invented process summaries and note (as in BeforeSubmit.test.tsx, WEB-25); no real student data.
const summaryWithGap: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 1,
    items: [{ from: "2026-11-10T09:00:00.000Z", to: "2026-11-10T10:00:00.000Z" }] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200,
    listed: [{ at: { from: "2026-11-10T09:20:00.000Z", to: "2026-11-10T09:21:00.000Z" }, characters: 340, origin: "not_observed" }],
    smallerCount: 2 },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-11-10T09:30:00.000Z", nextStartedAt: "2026-11-10T09:45:00.000Z" }] },
  recordState: "has_gaps",
};
const summaryEmpty: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, listed: [], smallerCount: 0 },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
};
const recorded = (summary: ProcessSummaryV1): RecordedSummary => summary;
const invented: SubmissionNote = { id: "izmisljena-napomena-1", text: "Izmišljena napomena uz predaju.", createdAt: "2026-11-10T10:05:00.000000Z" };
const nothing = () => undefined;
const declaration = (over: Partial<DeclarationViewProps>) => (
  <DeclarationView recorded={{ kind: "ready", summary: recorded(summaryWithGap) }} confirmed
    onConfirm={nothing} onNext={nothing} onBack={nothing} onRetry={nothing} {...over} />
);
const beforeSubmit = (over: Partial<BeforeSubmitViewProps>) => (
  <BeforeSubmitView summary={{ kind: "ready", summary: summaryWithGap }} notes={{ kind: "ready", notes: [invented] }}
    stage={{ kind: "open" }} confirmed online onNext={nothing} onDeclaration={nothing} onBack={nothing}
    onReceipt={nothing} onRetry={nothing} onOpenNote={nothing} {...over} />
);
const topBar = (title: string | null, online: boolean) => (
  <WorkspaceTopBarView assignmentId="izmisljeni-zadatak-1" title={title} online={online} theme="light" onTheme={nothing} />
);

/** The note dialog after the given presses: its states live inside it (PD-4), so the catalogue presses its own buttons. */
function NoteProbe({ text = "", press = false, pending = false }: { text?: string; press?: boolean; pending?: boolean }) {
  const ref = (box: HTMLDivElement | null) => {
    if (box === null || box.dataset.pressed === "yes") return;
    box.dataset.pressed = "yes";
    const field = box.querySelector("textarea");
    if (field !== null && text !== "") {
      // Typed as a person would, so React sees the change (a plain value assignment it would not).
      field.focus({ preventScroll: true });
      document.execCommand("insertText", false, text);
      field.blur();
    }
    if (press) queueMicrotask(() => box.querySelector("button")?.click());
  };
  return (
    <div ref={ref}>
      <NoteDialog open modal={false} onClose={nothing} onAdded={nothing}
        onAdd={() => (pending ? new Promise(() => undefined) : Promise.resolve({ kind: "added" as const, note: invented }))} />
    </div>
  );
}

// Invented roster (WEB-31, N-04): two groups, a seminar that opens N-06, a student without a name.
type Roster = Parameters<typeof CourseStudents>[0]["result"];
const rosterStudents = [
  { studentId: "izmisljeni-student-1", name: "Vesna Žbunić", group: "A", works: [
    { assignmentId: "izmisljeni-zadatak-1", state: "predano", title: "Izmišljeni seminar", workType: "seminar_paper",
      documentId: "70000000-0000-4000-8000-000000000011" },
  ] },
  { studentId: "izmisljeni-student-2", name: "Ana Izmišljenić", group: "B", works: [
    { assignmentId: "izmisljeni-zadatak-1", state: "nakon_roka", title: "Izmišljeni seminar", workType: "seminar_paper", documentId: null },
    { assignmentId: "izmisljeni-zadatak-2", state: "ceka", title: "Izmišljeni ogled", workType: "essay" },
  ] },
  { studentId: "izmisljeni-student-3", name: null, group: "A", works: [] },
] satisfies (Roster & { kind: "ready" })["students"];
const roster = (result: Roster) => <CourseStudents result={result} />;

// Invented mentorship requests (WEB-32, N-16).
const requests: (RequestsRead & { kind: "ready" })["requests"] = [
  { requestId: "70000000-0000-4000-8000-000000000101", studentName: "Vesna Žbunić", title: "Izmišljeni završni rad", workType: "bachelor_thesis", requestedAt: "2026-11-02T09:00:00Z" },
  { requestId: "70000000-0000-4000-8000-000000000102", studentName: null, title: "Izmišljeni diplomski rad", workType: "master_thesis", requestedAt: "2026-11-05T13:30:00Z" },
];
/** The first button pressed once on mount: a state that lives inside the screen. */
const pressFirst = (box: HTMLDivElement | null) => {
  if (box === null || box.dataset.pressed === "yes") return;
  box.dataset.pressed = "yes";
  queueMicrotask(() => box.querySelector("button")?.click());
};

export const SCREEN_ENTRIES = {
  AppShell: {
    prazno: () => <AppShell navId="bocna-navigacija-1" role={null} scope={null} crumbs={[]} ownMain>{page}</AppShell>,
    učitavanje: () => <AppShell navId="bocna-navigacija-2" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="status">{t.student.loading}</p></AppShell>,
    greška: () => <AppShell navId="bocna-navigacija-3" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="alert">{t.errorPage.errorBody}</p></AppShell>,
    puno: () => <AppShell navId="bocna-navigacija-4" role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain>{page}</AppShell>,
    onemogućeno: () => <AppShell navId="bocna-navigacija-5" role={null} scope={SCOPE} crumbs={[]} ownMain>{page}</AppShell>,
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
  AssignmentOverview: {
    prazno: () => <AssignmentOverview assignmentTitle="Izmišljeni seminar" rows={[]} />,
    učitavanje: () => <AssignmentOverview assignmentTitle="Izmišljeni seminar" rows={null} loading />,
    greška: () => <AssignmentOverview assignmentTitle="Izmišljeni seminar" rows={null} retryHref="/nastavnik/zbirni" />,
    puno: () => <AssignmentOverview assignmentTitle="Izmišljeni seminar" rows={overviewRows} />,
    // Names the server does not have: shown as missing, never as a stand-in.
    onemogućeno: () => <AssignmentOverview assignmentTitle="Izmišljeni esej" rows={[overviewRow(5, { name: null, group: null })]} />,
  },
  MentoredWorks: {
    prazno: () => <MentoredWorks works={[]} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <MentoredWorks works={[mentored(5, null, { documentId: null, workState: "not_started" })]} />,
    puno: () => <MentoredWorks works={mentoredWorks} />,
    onemogućeno: () => <MentoredWorks works={[mentored(6, { givenName: "Iva", familyName: "Izmišljenić" }, { documentId: null, workState: "not_started", workType: "doctoral_thesis" })]} />,
  },
  LiveWorkFrame: {
    prazno: () => <LiveWorkFrame documentId="izmisljeni-rad-2" frame={null} recordState={null} text={<p role="status">{t.workspace.panelLoading}</p>} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <LiveWorkFrame documentId="izmisljeni-rad-2" frame={null} recordState={null} text={<p role="alert">{t.errorPage.errorBody}</p>} />,
    puno: () => <LiveWorkFrame documentId="izmisljeni-rad-2" frame={liveFrame()} recordState="has_gaps" text={liveText} />,
    onemogućeno: () => <LiveWorkFrame documentId="izmisljeni-rad-2" frame={liveFrame({ submitted: true, previousId: null, nextId: null })} recordState="complete" text={liveText} />,
  },
  // WEB-23 (S: E-7): the bar has no error of its own; a title the read could not give shows the generic one.
  WorkspaceTopBar: {
    prazno: () => topBar(null, true),
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <div>{topBar(null, true)}<p role="alert">{t.errorPage.errorBody}</p></div>,
    puno: () => topBar("Izmišljeni seminar: javne politike", true),
    onemogućeno: () => topBar("Izmišljeni seminar: javne politike", false),
  },
  // WEB-24 (S: E-9): the declaration step as DeclarationView draws it; the page adds only the router.
  Declaration: {
    prazno: () => declaration({ recorded: { kind: "ready", summary: recorded(summaryEmpty) }, confirmed: false }),
    učitavanje: () => declaration({ recorded: { kind: "loading" }, confirmed: false }),
    greška: () => declaration({ recorded: { kind: "error" }, confirmed: false }),
    puno: () => declaration({}),
    onemogućeno: () => declaration({ confirmed: false }),
  },
  // WEB-25 (S: E-8): the step before submitting as BeforeSubmitView draws it.
  BeforeSubmit: {
    prazno: () => beforeSubmit({ summary: { kind: "ready", summary: summaryEmpty }, notes: { kind: "ready", notes: [] } }),
    učitavanje: () => beforeSubmit({ summary: { kind: "loading" }, notes: { kind: "loading" } }),
    greška: () => beforeSubmit({ summary: { kind: "error" }, notes: { kind: "unavailable" } }),
    puno: () => beforeSubmit({}),
    onemogućeno: () => beforeSubmit({ online: false }),
  },
  // PD-4: empty, a press on "Dodaj" with nothing written, a written note, and a note on its way (nothing answers).
  NoteDialog: {
    prazno: () => <NoteProbe />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <NoteProbe press />,
    puno: () => <NoteProbe text="Izmišljena napomena uz predaju." />,
    onemogućeno: () => <NoteProbe text="Izmišljena napomena uz predaju." press pending />,
  },
  // WEB-31 (N-04): "onemogućeno" is a roster with no work to open (an essay, a seminar without a document).
  CourseStudents: {
    prazno: () => roster({ kind: "ready", students: [], courseName: "Izmišljeni kolegij" }),
    učitavanje: () => roster({ kind: "loading" }),
    greška: () => roster({ kind: "unavailable", retryHref: "/nastavnik/kolegiji" }),
    puno: () => roster({ kind: "ready", students: rosterStudents, courseName: "Izmišljeni kolegij" }),
    onemogućeno: () => roster({ kind: "ready", students: rosterStudents.slice(1) }),
  },
  // WEB-32 (N-16): "onemogućeno" is a decision on its way (nothing answers): the other request waits.
  MentorshipRequests: {
    prazno: () => <MentorshipRequests read={{ kind: "ready", requests: [] }} here="/nastavnik/mentorstva" />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => <MentorshipRequests read={{ kind: "unavailable" }} here="/nastavnik/mentorstva" />,
    puno: () => <MentorshipRequests read={{ kind: "ready", requests }} here="/nastavnik/mentorstva" />,
    onemogućeno: () => (
      <div ref={pressFirst}>
        <MentorshipRequestsView read={{ kind: "ready", requests }} here="/nastavnik/mentorstva" call={() => new Promise(() => undefined)} />
      </div>
    ),
  },
  // WEB-26 (PD-3): a failed submission is told by the page, never by the dialog, so greška is the
  // dialog asked again after the page's alert; onemogućeno is the submission on its way.
  SubmitDialog: {
    prazno: () => <SubmitDialog open modal={false} revision={1} late={false} sending={false} onSubmit={nothing} onClose={nothing} />,
    učitavanje: () => <RouteLoading label={t.workspace.panelLoading} />,
    greška: () => (
      <div>
        <p role="alert">{t.errorPage.errorBody}</p>
        <SubmitDialog open modal={false} revision={4} late={false} sending={false} onSubmit={nothing} onClose={nothing} />
      </div>
    ),
    puno: () => <SubmitDialog open modal={false} revision={4} late sending={false} onSubmit={nothing} onClose={nothing} />,
    onemogućeno: () => <SubmitDialog open modal={false} revision={4} late={false} sending onSubmit={nothing} onClose={nothing} />,
  },
} satisfies Record<string, Entry> satisfies CatalogEntries;
