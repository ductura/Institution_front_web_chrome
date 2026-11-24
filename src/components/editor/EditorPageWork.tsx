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

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";

import { openWork, type OpenOutcome } from "@/client/evidence-ingest";
import { useOnline } from "@/client/online-status";
import type { SessionMark } from "@/client/session-marks";
import SessionObserver from "@/components/shell/SessionObserver";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorPage, { SheetNote } from "./EditorPage";
import { openFailureExit, openFailureText, type OpenFailure } from "./open-failure";
import { readJournalScope, type ScopeRead } from "./EditorPage.scope";
import EditorToolbar from "./EditorToolbar";
import type { FootnoteDialogComponent } from "./footnotes/useV3EditorDialogs";
import EditorCommands from "./commands/EditorCommands";
import { LocalDocumentProvider, LocalEditor, useLocalEditor, useLocalPending, useLocalSaveRead, useLocalSavingOnDevice, useLocalSignedOut, useLocalSubmitted } from "./LocalDocument";
import { offlineWaitingText, reconnectShown, reconnectText } from "./save-level";
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
  /** ED-09 (NF2-P9): cards under the Asistent card ("Pravila za ovaj zadatak"). */
  assistant?: (ctx: HostSectionContext) => ReactNode;
  /** ED-09 (NF2-P9): the assignment's instructions in "Prvi redak"; none without it. */
  instructions?: (ctx: HostSectionContext) => ReactNode;
};

export type OpenRead =
  | { readonly kind: "opening" }
  | { readonly kind: "ready"; readonly documentId: string; readonly scope: string; readonly session: SessionMark; readonly schemaVersion?: number }
  /** ED-01b: the cause of a failed open, said with its one way out. */
  | { readonly kind: "failed"; readonly failure: OpenFailure };

const failed = (failure: OpenFailure): OpenRead => ({ kind: "failed", failure });

/** What the page does with one answer of the open route, under the person's journal scope and session. */
export function openReadOf(outcome: OpenOutcome, scope: string, session: SessionMark): OpenRead {
  switch (outcome.status) {
    case "opened":
      return { kind: "ready", documentId: outcome.work.documentId, scope, session,
        ...(outcome.work.schemaVersion === undefined ? {} : { schemaVersion: outcome.work.schemaVersion }) };
    case "unauthenticated":
      return failed("signedOut");
    case "not_found":
      return failed("missing");
    case "not_accepting":
      return failed("closed");
    case "upgrade_required":
      return failed("reload");
    case "unavailable":
      return failed(outcome.offline ? "offline" : "server");
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
  // A sign-in without a journal scope cannot open a work: the way out is to sign in again (NF2-P1).
  if (scope.kind === "signedOut" || scope.kind === "noScope") return failed("signedOut");
  if (scope.kind === "unavailable") return failed(scope.offline ? "offline" : "server");
  const outcome = await readers.open(assignmentId).catch((): OpenOutcome => ({ status: "unavailable" }));
  return openReadOf(outcome, scope.scope, scope.session);
}

/**
 * ED-01b: the opening note, or the cause of a failed open in `role="alert"` with
 * its one way out. The frame says the same sentence for the same cause.
 */
function Note({ read, assignmentId, base, onRetry }: {
  read: Exclude<OpenRead, { kind: "ready" }>; assignmentId: string; base: string; onRetry: () => void;
}) {
  if (read.kind === "opening") return <SheetNote>{t.workspace.openLoading}</SheetNote>;
  const exit = openFailureExit(read.failure, { assignmentId, base });
  return (
    <div role="alert" data-open-failure={read.failure}>
      <p>{openFailureText(read.failure)}</p>
      {exit.kind === "link"
        ? <a className="btn" href={exit.href}>{exit.label}</a>
        : <button type="button" className="btn" onClick={exit.kind === "retry" ? onRetry : () => globalThis.location.reload()}>{exit.label}</button>}
    </div>
  );
}

export default function EditorPageWork({
  assignmentId,
  base = "",
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
  /** The host's base path, for the links of a failed open (ED-01b); "" at the root. */
  base?: string;
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
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (attempt > 0) setRead({ kind: "opening" });
    void readWork(assignmentId)
      .catch((): OpenRead => failed("server"))
      .then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [assignmentId, attempt]);

  if (read.kind !== "ready") {
    return (
      <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={null} length={length} />}>
        <Note read={read} assignmentId={assignmentId} base={base} onRetry={() => setAttempt((n) => n + 1)} />
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
  const { phase, state, receiptVerified } = useLocalSaveRead();
  const savingLocally = useLocalSavingOnDevice();
  const online = useOnline();
  const pending = useLocalPending(online);
  const reconnected = useReconnected(online, pending, pending === 0 || (state === "SYNCED" && receiptVerified));
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
      status={<StatusBarLive evidence length={length} online={saveSummary ? online : undefined} pending={pending} liveWords={Boolean(statusExtra)}>{statusExtra}</StatusBarLive>}
      rightSections={{ sources: <>{literature?.({ documentId })}<EditorSourceProofs assignmentId={assignmentId} documentId={documentId} /></>,
        comments: hostSections?.comments ? hostSections.comments(ctx) : <CommentPanel documentId={documentId} session={session} />,
        review: hostSections?.review?.(ctx),
        assistant: <><AssistantComingSoonCard />{hostSections?.assistant?.(ctx)}</> }}
      renderWork={(closeDrawer) => <>
        {!signedOut && <SubmissionRehearsal editor={editor} assignmentId={assignmentId} documentId={documentId}
          sessionTag={session.tag} session={session} onJumpToDocument={closeDrawer}
          supplements={supplements} onPrintPreview={() => setPrintOpen(true)} />}
        <RevisionPanel documentId={documentId} assignmentId={assignmentId} session={session} />
        {hostSections?.work?.(ctx)}
      </>}>
      <EditorNotices notices={!online
        ? [{ kind: "offline", savingLocally, resumesSync: true, waiting: pending ? offlineWaitingText(pending) : null }]
        : reconnected ? [{ kind: "reconnected", sending: reconnectText(pending) }] : []} />
      <LocalEditor />
      {triggers ? triggers({ documentId }) : <TriggerPopover editor={editor} />}
      <EditorHelpDialogs view={view} onClose={() => setView(null)} help={help} documentId={documentId}
        fresh={phase === "ready" && editor?.isEmpty}
        notice={{ course, title, length: length?.range ?? undefined, instructions: hostSections?.instructions?.(ctx) ?? null }} />
    </EditorPanelLayout>
  );
}

/**
 * ED-01c (NF2-P2 b): true from the return of the network, with changes
 * waiting, until nothing waits (`settled`). It never says the server.
 */
function useReconnected(online: boolean, pending: number | null, settled: boolean): boolean {
  const wasOnlineRef = useRef(online);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const next = reconnectShown(shown, wasOnlineRef.current, { online, pending, settled });
    wasOnlineRef.current = online;
    if (next !== shown) setShown(next);
  }, [online, pending, settled, shown]);
  return shown;
}
