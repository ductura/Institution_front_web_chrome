"use client";

// HOST-S1 (graditelj, 21. 11. 2026.): the student's work on one assignment in
// the host (WEB-14, WEB-23), read only through src/client, as the copied page
// src/app/rad/[assignmentId]/page.tsx does on the server: student.assignments.get
// and student.assignment-work.get with the session's cookie. Signed out →
// AAI@EduHr sign-in, back here; a notice not yet acknowledged → the notice
// first; anyone else's or an unknown assignment → not found. A work in
// progress mounts EditorPageWork, which opens the journal and evidence
// (B-8); no save state is claimed while no journal is open.
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { appHref } from "../../../../../src/components/index.ts";
import EditorPage, { SheetNote } from "../../../../../src/components/editor/EditorPage.tsx";
import { editorWorkRead } from "../../../../../src/components/editor/EditorPage.read.ts";
import EditorPageWork from "../../../../../src/components/editor/EditorPageWork.tsx";
import { ReadOnlyMentor } from "../../../../../src/components/editor/mentor/work-state/ReadOnlyMentor.tsx";
import { readSubmittedWork } from "../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts";
import StatusBar from "../../../../../src/components/editor/StatusBar.tsx";
import WorkspaceTopBar from "../../../../../src/components/editor/WorkspaceTopBar.tsx";
import { workspaceFrame, type WorkspaceVariant } from "../../../../../src/components/editor/workspace-variant.ts";
import { browserTransport, createApi, goToSignIn } from "../../../../../src/client/api.ts";
import { messagesHr as t } from "../../../../../src/lib/i18n/messages.hr.ts";

import { SaveState } from "@ductura/ui";
import { hostText } from "../../text";
import { nextPath } from "../../bases";
import { useHost } from "../context";
import { EditorSessionControls } from "../editor/save-status/EditorSessionControls";
import { ImportHost } from "../editor/import/ImportHost";
import { RevisionActionsHost } from "../editor/work/review/ReviewHost";
import { ShellView } from "../editor/shell/ShellView";
import { RulesHost } from "../editor/rules/RulesHost";
import PdfExport from "../editor/export/PdfExport";
import { StatusExtras, useRehearsalSupplements } from "../editor/status/StatusExtras";
import { PregledHost } from "../editor/right/PregledHost";
import { SourcesMention } from "../editor/sources-mention/SourcesMention";
import { LiteratureList } from "../editor/sources-mention/LiteratureList";
import { MarksHost } from "../editor/marks/MarksHost";
import { ChapterPanel } from "../editor/left/ChapterPanel";
import { leftSectionsFor } from "../editor/left/LeftSectionsHost";
import { StartWork } from "./start-work/StartWork";
import { DirectEditSettingHost } from "./direct-edit-setting/DirectEditSetting";
import { readWordRange } from "./work/requirements";
import { workText } from "./work/messages.hr";
import { Banner, ErrorCard, FrameStatus, LoadingCard, OfflineBanner, courseLine, momentHr } from "./work/frame";
import { unavailableTransport } from "../../../../../src/client/import.ts";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/** What the sheet holds when no editor is mounted. */
function sheetBody(variant: WorkspaceVariant, assignmentId: string, title: string | null): ReactNode {
  if (variant === "predano") return <SheetNote>{t.editor.submittedReadOnly}</SheetNote>;
  // WEB-2105: E-7 `prazno`: the empty sheet with its placeholder, and the way to start (the server decides).
  if (variant === "prazno") {
    return (
      <>
        <SheetNote>{workText.notStarted}</SheetNote>
        <p aria-hidden="true">{workText.placeholder}</p>
        <StartWork assignmentId={assignmentId} title={title ?? ""} />
      </>
    );
  }
  return (
    <SheetNote>
      {t.workspace.documentNotEditable} <span className="soon">{t.workspace.soon}</span>
    </SheetNote>
  );
}

type Shown = { kind: "loading" } | { kind: "notFound" } | { kind: "page"; node: ReactNode };

export function WorkPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const router = useRouter();
  const [shown, setShown] = useState<Shown>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (attempt > 0) setShown({ kind: "loading" });
    const here = appHref(base, `/rad/${assignmentId}`);
    void (async () => {
      const client = createApi();
      const [assignments, work, wordRange] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
        readWordRange(assignmentId),
      ]);
      if (!live) return;
      const read = editorWorkRead(assignmentId, assignments as never, work as never);
      if (read.kind === "signedOut") return goToSignIn(here);
      if (read.kind === "noticeFirst") return router.replace(nextPath(base, `/zadatak/${assignmentId}`));
      if (read.kind === "notFound") return setShown({ kind: "notFound" });
      const frame = workspaceFrame(read, undefined, { kind: "ready", wordRange });
      const title = read.kind === "ready" ? read.title : null;
      const subtitle = read.kind === "ready" ? courseLine(read.course, read.dueAt) : null;
      const bar = <WorkspaceTopBar assignmentId={assignmentId} title={title} subtitle={subtitle}
        readOnly={frame.variant === "predano"} inert={frame.variant === "greska"} />;
      // WEB-2136: view mode, "samo naslovi" and panel widths, only where the panels are (the full editor).
      const topBar = frame.variant === "puno" ? <ShellView>{bar}</ShellView> : bar;
      const length = { words: null, range: frame.range };
      if (read.kind === "ready" && frame.variant === "puno") {
        return setShown({
          kind: "page",
          node: <EditorPageWork assignmentId={assignmentId} course={read.course} title={read.title} topBar={topBar} length={length}
            statusExtra={<StatusExtras />} useSupplements={useRehearsalSupplements}
            triggers={({ documentId }) => <SourcesMention documentId={documentId} />}
            literature={() => <LiteratureList />}
            hostSections={{
              review: ({ editor, assignmentId: id, documentId }) => <PregledHost editor={editor} assignmentId={id} documentId={documentId} />,
              work: ({ documentId }) => <RevisionActionsHost documentId={documentId} role="student" today={new Date().toISOString().slice(0, 10)} />,
            }}
            leftSections={({ documentId }) => ({ ...leftSectionsFor(assignmentId, documentId), chapter: <ChapterPanel workId={assignmentId} /> })}
            renderPdf={(version) => <PdfExport assignmentId={assignmentId} version={version} here={`/rad/${assignmentId}`} />}
            sessionControls={({ scope, session, documentId }) => <>
              <EditorSessionControls scope={scope} session={session} assignmentId={assignmentId} />
              <DirectEditSettingHost documentId={documentId} here={here} />
              <ImportHost assignmentId={assignmentId} transport={unavailableTransport} />
              <RulesHost role="student" />
              <MarksHost />
            </>} />,
        });
      }
      const submission = frame.variant === "predano"
        ? await readSubmittedWork(assignmentId, { baseUrl: window.location.origin, fetchImpl: browserTransport })
        : null;
      if (!live) return;
      if (submission?.kind === "session-expired") return goToSignIn(here);
      const receipt = submission?.kind === "potvrdeno" ? submission.receipt.payload : undefined;
      const submittedAt = receipt?.requestedAt === undefined ? null : momentHr(receipt.requestedAt);
      setShown({
        kind: "page",
        node: (
          <EditorPage
            course={read.kind === "ready" ? read.course : null}
            title={title}
            topBar={topBar}
            heading={frame.variant === "predano"}
            banner={frame.variant === "predano"
              ? <Banner lead={submittedAt === null ? undefined : workText.submittedLead.replace("{at}", submittedAt)}>{workText.submittedBody}</Banner>
              : frame.variant === "greska" ? null : <OfflineBanner />}
            stand={frame.variant === "greska" ? <ErrorCard onRetry={() => setAttempt((n) => n + 1)} /> : undefined}
            status={frame.variant === "greska"
              ? <FrameStatus chip={<SaveState state="ERROR" label={workText.errorStatus} />} />
              : frame.variant === "prazno"
                ? <FrameStatus chip={<SaveState state="LOCAL_DURABLE" label={workText.newWork} />} length={length} withNet />
                : <StatusBar save={null} readOnly={frame.variant === "predano"} length={length} />}
            aside={frame.variant === "predano" && <>
              <ReadOnlyMentor role="student" submitted documentId={receipt?.documentId} submittedAt={receipt?.requestedAt} />
              {receipt?.documentId === undefined ? null : <DirectEditSettingHost documentId={receipt.documentId} here={here} submitted />}
            </>}
          >
            {sheetBody(frame.variant, assignmentId, title)}
          </EditorPage>
        ),
      });
    })();
    return () => {
      live = false;
    };
  }, [assignmentId, base, attempt]);
  if (shown.kind === "notFound") notFound();
  if (shown.kind === "loading") {
    // E-7 `ucitavanje`: the frame with a disabled "Predaja rada" and the card of grey bars.
    return (
      <EditorPage course={null} title={null} topBar={<WorkspaceTopBar assignmentId={assignmentId} title={null} inert />}
        stand={<LoadingCard />} status={<FrameStatus chip={<SaveState state="LOCAL_DURABLE" label={workText.loading} />} />}>
        {null}
      </EditorPage>
    );
  }
  return <>{shown.node}</>;
}
