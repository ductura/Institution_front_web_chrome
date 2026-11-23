"use client";

/**
 * The editor mounted on `/rad/<assignmentId>` (WEB-14b) for a work already
 * started. First the person's journal scope is read from the session route (WEB-14c,
 * fail closed: without a valid `journalScope` and `sessionTag` nothing is
 * opened). The session mark goes to SessionObserver and the provider, so a
 * sign-out or another sign-in elsewhere stops this sheet. Then the
 * work is opened once through src/client (`openWork`, evidence.open.post over
 * createApi); its documentId names the document in that journal. Then
 * LocalDocument owns the editor, the journal, the Web Lock (one writer per
 * document, A-12) and the EvidenceSession that sends the text and verifies
 * each receipt. The toolbar (WEB-15) and the status bar read that provider.
 * Nothing here sends text by itself.
 */

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";

import { signInHref } from "@/client/api";
import { openWork, type OpenOutcome } from "@/client/evidence-ingest";
import { useOnline } from "@/client/online-status";
import type { SessionMark } from "@/client/session-marks";
import SessionObserver from "@/components/shell/SessionObserver";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorPage, { SheetNote } from "./EditorPage";
import { readJournalScope, type ScopeRead } from "./EditorPage.scope";
import EditorToolbar from "./EditorToolbar";
import type { FootnoteDialogComponent } from "./footnotes/useV3EditorDialogs";
import EditorCommands from "./commands/EditorCommands";
import { LocalDocumentProvider, LocalEditor, useLocalEditor, useLocalSaveRead, useLocalSavingOnDevice, useLocalSignedOut, useLocalSubmitted } from "./LocalDocument";
import { EditorHelpDialogs, useEditorHelp, type EditorHelpView } from "./help/EditorHelp";
import { EditorHelpMenu } from "./help/EditorHelpMenu";
import { EditorNotices } from "./help/EditorNotices";
import helpStyles from "./help/EditorHelp.module.css";
import { AssistantComingSoonCard } from "./assistant/coming-soon/AssistantComingSoonCard";
import { EditorSourceProofs } from "./sources/proofs/editor-source-proofs";
import StatusBar from "./StatusBar";
import StatusBarLive from "./StatusBarLive";
import CommentPanel from "./CommentPanel";
import RevisionPanel from "./RevisionPanel";
import { EditorPanelLayout } from "./SidePanels";
import { SubmissionRehearsal, type SubmissionRehearsalProps } from "./submission-rehearsal/SubmissionRehearsal";
import type { LeftSections } from "./layout-prefs/LeftPanel";
import { WorkPrintExport, type RenderPdf } from "./print-export/docx-download/WorkPrintExport";
import { TriggerPopover } from "./triggers/TriggerPopover";

/** A host's toolbar for the tools slot; it is mounted inside the document provider. */
export type ToolbarSlot = (ctx: {
  workPartsKey: string; footnoteDialog?: FootnoteDialogComponent;
  /** The server-confirmed schema version of the work; footnotes open only for 3. */
  confirmedWorkSchemaVersion?: number;
}) => ReactNode;

/** What a host section is given: the live editor, the ids of the work and the state of its session. */
export type HostSectionContext = {
  editor: Editor | null; assignmentId: string; documentId: string;
  session: SessionMark; submitted: boolean; signedOut: boolean;
};
/**
 * `comments` is the host's Comments card (PIL-K-KOMENTARI-EDITOR); when the host gives one, the
 * old CommentPanel is not rendered at all.
 */
export type HostSections = {
  review?: (ctx: HostSectionContext) => ReactNode;
  work?: (ctx: HostSectionContext) => ReactNode;
  comments?: (ctx: HostSectionContext) => ReactNode;
};

export type OpenRead =
  | { readonly kind: "opening" }
  | { readonly kind: "ready"; readonly documentId: string; readonly scope: string; readonly session: SessionMark; readonly schemaVersion?: number }
  | { readonly kind: "signedOut" }
  | { readonly kind: "closed" }
  | { readonly kind: "reload" }
  | { readonly kind: "unavailable" };

/** What the page does with one answer of the open route, under the person's journal scope and session. */
export function openReadOf(outcome: OpenOutcome, scope: string, session: SessionMark): OpenRead {
  switch (outcome.status) {
    case "opened":
      return { kind: "ready", documentId: outcome.work.documentId, scope, session,
        ...(outcome.work.schemaVersion === undefined ? {} : { schemaVersion: outcome.work.schemaVersion }) };
    case "unauthenticated":
      return { kind: "signedOut" };
    case "not_found":
    case "not_accepting":
      return { kind: "closed" };
    case "upgrade_required":
      return { kind: "reload" };
    default:
      return { kind: "unavailable" };
  }
}

export type WorkReaders = {
  readonly readScope: () => Promise<ScopeRead>;
  readonly open: (assignmentId: string) => Promise<OpenOutcome>;
};

const LIVE_READERS: WorkReaders = { readScope: () => readJournalScope(), open: (id) => openWork(id) };

/**
 * The scope first, then the work: no valid scope (WEB-14c) opens nothing, not
 * even the evidence session, and the page shows that the work cannot be opened.
 */
export async function readWork(assignmentId: string, readers: WorkReaders = LIVE_READERS): Promise<OpenRead> {
  const scope = await readers.readScope().catch((): ScopeRead => ({ kind: "unavailable" }));
  if (scope.kind === "signedOut") return { kind: "signedOut" };
  if (scope.kind !== "scope") return { kind: "unavailable" };
  const outcome = await readers.open(assignmentId).catch((): OpenOutcome => ({ status: "unavailable" }));
  return openReadOf(outcome, scope.scope, scope.session);
}

function Note({ read, here }: { read: Exclude<OpenRead, { kind: "ready" }>; here: string }) {
  if (read.kind === "opening") return <SheetNote>{t.workspace.openLoading}</SheetNote>;
  if (read.kind === "signedOut") {
    return (
      <SheetNote>
        {t.auth.signedOutElsewhere} <a href={signInHref(here)}>{t.auth.signInAgain}</a>
      </SheetNote>
    );
  }
  if (read.kind === "reload") return <SheetNote>{t.workspace.openReload}</SheetNote>;
  if (read.kind === "closed") return <SheetNote>{t.workspace.openNotAccepting}</SheetNote>;
  return <SheetNote>{t.workspace.openError}</SheetNote>;
}

export default function EditorPageWork({
  assignmentId,
  course,
  title,
  topBar,
  length,
  sessionControls,
  renderPdf,
  statusExtra,
  useSupplements,
  triggers,
  literature,
  hostSections,
  leftSections,
  footnoteDialog,
  toolbar,
}: {
  assignmentId: string;
  course: string;
  title: string;
  topBar?: ReactNode;
  length?: ComponentProps<typeof StatusBar>["length"];
  sessionControls?: (work: Extract<OpenRead, { kind: "ready" }>) => ReactNode;
  /** The host's PDF download in the print preview (WEB-1803). */
  renderPdf?: RenderPdf;
  /** Rendered at the end of the status bar, inside the document provider (host/editor/status). */
  statusExtra?: ReactNode;
  /** The rehearsal's extra rows; a hook of the host, constant for the page's life. */
  useSupplements?: () => SubmissionRehearsalProps["supplements"];
  /** The host's "@" and "/" menus with the sources of the work; without it the menus open without sources (WEB-2123). */
  triggers?: (work: { documentId: string }) => ReactNode;
  /** The host's list of the work's sources above the proofs in the sources card (WEB-2123). */
  literature?: (work: { documentId: string }) => ReactNode;
  /** Cards the host adds to the right panel (WEB-2121): the Pregled card and the revision actions. */
  hostSections?: HostSections;
  /** The host's sections of the left panel (WEB-2126). */
  /** The left panel's sections, or a function of the opened work's document (PIL-D7-POVIJEST). */
  leftSections?: LeftSections | ((work: { documentId: string }) => LeftSections);
  /** The host's footnote dialog in place of the copied one (PIL-K-FUSNOTA). */
  footnoteDialog?: NonNullable<ComponentProps<typeof EditorToolbar>>["footnoteDialog"];
  /** The host's toolbar for the tools slot in place of the copied EditorToolbar (PIL-K-TRAKA). */
  toolbar?: ToolbarSlot;
}) {
  const [read, setRead] = useState<OpenRead>({ kind: "opening" });
  useEffect(() => {
    let live = true;
    void readWork(assignmentId)
      .catch((): OpenRead => ({ kind: "unavailable" }))
      .then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [assignmentId]);

  if (read.kind !== "ready") {
    return (
      <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={null} length={length} />}>
        <Note read={read} here={`/rad/${assignmentId}`} />
      </EditorPage>
    );
  }
  return (
    <>
      <SessionObserver tag={read.session.tag} at={read.session.at} />
      {/* The confirmed schema version is part of the key: another version mounts a new sheet (PIL-K-SHEMA-V3). */}
      <LocalDocumentProvider key={`${read.session.tag}:${read.scope}:${read.documentId}:${read.schemaVersion ?? ""}`} scope={read.scope} documentId={read.documentId} assignmentId={assignmentId} session={read.session} schemaVersion={read.schemaVersion}>
        <WorkSurface course={course} title={title} topBar={topBar} length={length}
          assignmentId={assignmentId} documentId={read.documentId} scope={read.scope} session={read.session} schemaVersion={read.schemaVersion} saveSummary={Boolean(sessionControls)} renderPdf={renderPdf} hostSections={hostSections} leftSections={leftSections} footnoteDialog={footnoteDialog} toolbar={toolbar} triggers={triggers} literature={literature}
          statusExtra={statusExtra} useSupplements={useSupplements} />
        {sessionControls?.(read)}
      </LocalDocumentProvider>
    </>
  );
}

const noSupplements = (): SubmissionRehearsalProps["supplements"] => undefined;

function WorkSurface({ course, title, topBar, length, assignmentId, documentId, scope, session, schemaVersion, saveSummary, renderPdf, hostSections, leftSections, footnoteDialog, toolbar, triggers, literature, statusExtra, useSupplements }: {
  course: string;
  title: string;
  topBar?: ReactNode;
  length?: ComponentProps<typeof StatusBar>["length"];
  assignmentId: string;
  documentId: string;
  scope: string;
  session: SessionMark;
  schemaVersion?: number;
  saveSummary: boolean;
  renderPdf?: RenderPdf;
  statusExtra?: ReactNode;
  useSupplements?: () => SubmissionRehearsalProps["supplements"];
  triggers?: (work: { documentId: string }) => ReactNode;
  /** The host's list of the work's sources above the proofs in the sources card (WEB-2123). */
  literature?: (work: { documentId: string }) => ReactNode;
  hostSections?: HostSections;
  /** The left panel's sections, or a function of the opened work's document (PIL-D7-POVIJEST). */
  leftSections?: LeftSections | ((work: { documentId: string }) => LeftSections);
  /** The host's footnote dialog in place of the copied one (PIL-K-FUSNOTA). */
  footnoteDialog?: NonNullable<ComponentProps<typeof EditorToolbar>>["footnoteDialog"];
  /** The host's toolbar for the tools slot in place of the copied EditorToolbar (PIL-K-TRAKA). */
  toolbar?: ToolbarSlot;
}) {
  const editor = useLocalEditor();
  const useRows = useSupplements ?? noSupplements;
  const supplements = useRows();
  const [printOpen, setPrintOpen] = useState(false);
  const signedOut = useLocalSignedOut();
  const submitted = useLocalSubmitted();
  const ctx: HostSectionContext = { editor, assignmentId, documentId, session, submitted, signedOut };
  const { phase } = useLocalSaveRead();
  const savingLocally = useLocalSavingOnDevice();
  const online = useOnline();
  const help = useEditorHelp();
  const [view, setView] = useState<EditorHelpView | null>(null);
  return (
    <EditorPanelLayout title={title} leftSections={typeof leftSections === "function" ? leftSections({ documentId }) : leftSections} header={topBar ?? <p>{course} / {title}</p>}
      tools={<EditorCommands><div className={helpStyles.toolbar}>
        {(() => {
          const workPartsKey = `ductura.editor.work-parts:${JSON.stringify([scope, documentId])}`;
          return toolbar ? toolbar({ workPartsKey, footnoteDialog, confirmedWorkSchemaVersion: schemaVersion })
            : <EditorToolbar footnoteDialog={footnoteDialog} workPartsKey={workPartsKey} confirmedWorkSchemaVersion={schemaVersion} />;
        })()}
        <EditorHelpMenu onSelect={setView} />
        {!signedOut && <WorkPrintExport documentId={documentId} title={title} renderPdf={renderPdf} open={printOpen} onOpenChange={setPrintOpen} />}
      </div></EditorCommands>}
      status={<StatusBarLive evidence length={length} online={saveSummary ? online : undefined} liveWords={Boolean(statusExtra)}>{statusExtra}</StatusBarLive>}
      rightSections={{ sources: <>{literature?.({ documentId })}<EditorSourceProofs assignmentId={assignmentId} documentId={documentId} /></>,
        comments: hostSections?.comments ? hostSections.comments(ctx) : <CommentPanel documentId={documentId} session={session} />,
        review: hostSections?.review?.(ctx),
        assistant: <AssistantComingSoonCard /> }}
      renderWork={(closeDrawer) => <>
        {!signedOut && <SubmissionRehearsal editor={editor} assignmentId={assignmentId} documentId={documentId}
          sessionTag={session.tag} session={session} onJumpToDocument={closeDrawer}
          supplements={supplements} onPrintPreview={() => setPrintOpen(true)} />}
        <RevisionPanel documentId={documentId} assignmentId={assignmentId} session={session} />
        {hostSections?.work?.(ctx)}
      </>}>
      <EditorNotices notices={online ? [] : [{ kind: "offline", savingLocally, resumesSync: true }]} />
      <LocalEditor />
      {triggers ? triggers({ documentId }) : <TriggerPopover editor={editor} />}
      <EditorHelpDialogs view={view} onClose={() => setView(null)} help={help} documentId={documentId}
        fresh={phase === "ready" && editor?.isEmpty}
        notice={{ course, title, length: length?.range ?? undefined, instructions: null }} />
    </EditorPanelLayout>
  );
}
