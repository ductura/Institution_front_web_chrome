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
import { editorWorkRead, frameFailureOf } from "../../../../../src/components/editor/EditorPage.read.ts";
import EditorPageWork from "../../../../../src/components/editor/EditorPageWork.tsx";
import { ReadOnlyMentor } from "../../../../../src/components/editor/mentor/work-state/ReadOnlyMentor.tsx";
import { readSubmittedWork } from "../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts";
import StatusBar from "../../../../../src/components/editor/StatusBar.tsx";
import WorkspaceTopBar from "../../../../../src/components/editor/WorkspaceTopBar.tsx";
import { workspaceFrame, type WorkspaceVariant } from "../../../../../src/components/editor/workspace-variant.ts";
import { browserTransport, createApi, goToSignIn } from "../../../../../src/client/api.ts";
import { withMentoredAssignments } from "../../../../../src/components/student/mentored-assignments.ts";
import { messagesHr as t } from "../../../../../src/lib/i18n/messages.hr.ts";

import { SaveState } from "@ductura/ui";
import { hostText } from "../../text";
import { nextPath } from "../../bases";
import { useHost } from "../context";
import { EditorSessionControls } from "../editor/save-status/EditorSessionControls";
import { AssistantMatchNoticeHost } from "../editor/assistant-match-notice/AssistantMatchNoticeHost";
import { ImportHost } from "../editor/import/ImportHost";
import { RevisionActionsHost } from "../editor/work/review/ReviewHost";
import { ShellView } from "../editor/shell/ShellView";
import { RulesHost } from "../editor/rules/RulesHost";
import { AssistantRules, NoticeInstructions } from "../editor/assistant-rules/AssistantRules";
import { AssistantChat } from "../editor/assistant-chat/AssistantChat";
import PdfExport from "../editor/export/PdfExport";
import { StatusExtras, beforeSubmissionFor, rehearsalSupplementsFor } from "../editor/status/StatusExtras";
import { PregledHost } from "../editor/right/PregledHost";
import { MentorMount } from "../editor/right/MentorMount";
import { SourcesMention } from "../editor/sources-mention/SourcesMention";
import { LiteratureList } from "../editor/sources-mention/LiteratureList";
import { courseIdOf } from "../editor/sources-mention/required-literature";
import { MarksHost } from "../editor/marks/MarksHost";
import { ReadAloudHost } from "../editor/read-aloud/ReadAloudHost";
import { CommentsHost } from "../editor/comments/CommentsHost";
import { ChapterMarks } from "../editor/left/ChapterMarks";
import { ChapterPanel } from "../editor/left/ChapterPanel";
import { FootnoteDialogHost } from "../editor/footnote/FootnoteHost";
import { StudentToolbar } from "../editor/toolbar/StudentToolbar";
import { CodeRunMount } from "../editor/code-run/CodeRunPanel";
import { TableOfContentsMount } from "../editor/toc/TableOfContentsMount";
import { leftSectionsFor, RailFooter } from "../editor/left/LeftSectionsHost";
import { StartWork } from "./start-work/StartWork";
import { SlidesWork } from "../slides/editor/SlidesWork";
import { workKindOf } from "../slides/editor/work-kind";
import { RubricCard } from "./rubric/RubricCard";
import { DirectEditSettingHost } from "./direct-edit-setting/DirectEditSetting";
import { WorkHistoryHost } from "../editor/work-history/WorkHistoryHost";
import { readWordRange } from "./work/requirements";
import { workText } from "./work/messages.hr";
import { ErrorCard, FrameStatus, LoadingCard, OfflineBanner, SubmittedBanner, courseLine, momentHr } from "./work/frame";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/** What the sheet holds when no editor is mounted. */
function sheetBody(variant: WorkspaceVariant, assignmentId: string, title: string | null, reread: () => void): ReactNode {
  if (variant === "predano") return <SheetNote>{t.editor.submittedReadOnly}</SheetNote>;
  // WEB-2105: E-7 `prazno`: the empty sheet with its placeholder, and the way to start (the server decides).
  if (variant === "prazno") {
    return (
      <>
        <SheetNote>{workText.notStarted}</SheetNote>
        <p aria-hidden="true">{workText.placeholder}</p>
        <StartWork assignmentId={assignmentId} title={title ?? ""} onOpened={reread} />
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
      const client = withMentoredAssignments(createApi());
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
      // WEB-NUZ-PREDAJA-1 (P-17): only the full editor has the text the count reads, so only it counts.
      const bar = <WorkspaceTopBar assignmentId={assignmentId} base={base} title={title} subtitle={subtitle}
        readOnly={frame.variant === "predano"} inert={frame.variant === "greska"}
        useBeforeCount={frame.variant === "puno" ? beforeSubmissionFor(assignmentId) : undefined} />;
      // WEB-2136: view mode, "samo naslovi" and panel widths, only where the panels are (the full editor).
      const topBar = frame.variant === "puno" ? <ShellView>{bar}</ShellView> : bar;
      const length = { words: null, range: frame.range };
      // WEB-V13-UREDNIK: a slides work in progress opens the slides editor, anything else the text editor below.
      // Its top bar is the plain one: the shell view switches and the history buttons only work on the text editor.
      const kind = workKindOf(assignments, assignmentId);
      if (read.kind === "ready" && frame.variant === "puno" && kind !== "text") {
        return setShown({ kind: "page", node: <SlidesWork assignmentId={assignmentId} course={read.course} title={read.title} topBar={<WorkspaceTopBar assignmentId={assignmentId} base={base} title={title} subtitle={subtitle} />} length={length} unreadable={kind === "unreadable"} onRetry={() => setAttempt((n) => n + 1)} /> });
      }
      if (read.kind === "ready" && frame.variant === "puno") {
        return setShown({
          kind: "page",
          node: <EditorPageWork assignmentId={assignmentId} base={base} course={read.course} title={read.title} topBar={topBar} length={length}
            statusExtra={<StatusExtras />} footnoteDialog={FootnoteDialogHost}
            toolbar={(ctx) => <><StudentToolbar {...ctx} /><CodeRunMount assignmentId={assignmentId} /></>} useSupplements={rehearsalSupplementsFor(assignmentId)}
            triggers={({ documentId }) => <SourcesMention documentId={documentId}
              openOrigin={() => router.push(nextPath(base, `/rad/${encodeURIComponent(assignmentId)}/podrijetlo`))} />}
            literature={() => <LiteratureList courseId={courseIdOf(assignments, assignmentId)} />}
            hostSections={{
              review: ({ editor, assignmentId: id, documentId }) => <PregledHost editor={editor} assignmentId={id} documentId={documentId} />,
              // WEB-NUZ-MENTOR-1 (MK-1): the whole Mentor card above the round's actions in the "Mentor" tab.
              work: ({ editor, assignmentId: id, documentId, submitted }) => <>
                <MentorMount editor={editor} assignmentId={id} documentId={documentId} submitted={submitted} />
                {/* ED-60 (Daniel, Ductus#2058 c.7185479035): the teacher's direct edits are set here, above the round's actions. */}
                <DirectEditSettingHost documentId={documentId} here={here} submitted={submitted} />
                <RevisionActionsHost documentId={documentId} role="student" today={new Date().toISOString().slice(0, 10)} />
              </>,
              // PIL-K-KOMENTARI-EDITOR: the Comments card over the real port, in place of the old CommentPanel.
              comments: ({ editor, documentId, session, submitted, signedOut }) =>
                <CommentsHost editor={editor} documentId={documentId} session={session} submitted={submitted} signedOut={signedOut} />,
              // ED-09 (NF2-P9): the assignment's rules under the Asistent card, its instructions in "Prvi redak".
              assistant: ({ submitted, signedOut, scope }) => <>
                <AssistantChat assignmentId={assignmentId} scope={scope} readOnly={submitted || signedOut} />
                <AssistantRules assignmentId={assignmentId} base={base} />
              </>,
              instructions: () => <><NoticeInstructions assignmentId={assignmentId} /><RubricCard assignmentId={assignmentId} here={here} /></>,
            }}
            leftSections={({ documentId }) => ({ ...leftSectionsFor(assignmentId, documentId, read.dueAt), chapter: <><TableOfContentsMount /><ChapterPanel workId={assignmentId} /></>,
              footer: <RailFooter range={frame.range} dueAt={read.dueAt} />,
              chapterMarks: (headingId, words, show) => <ChapterMarks workId={assignmentId} headingId={headingId} words={words} show={show} /> })}
            renderPdf={(version) => <PdfExport assignmentId={assignmentId} version={version} here={`/rad/${assignmentId}`} />}
            sessionControls={({ scope, session, documentId }) => <>
              <EditorSessionControls scope={scope} session={session} assignmentId={assignmentId} documentId={documentId} />
              <AssistantMatchNoticeHost documentId={documentId} />
              {/* ED-16 (NF2-P14): the one "Povijest i usporedba" dialog, asked by the header, Prikaz, Ctrl+K and the left panel. */}
              <WorkHistoryHost documentId={documentId} replayHref={appHref(base, `/rad/${assignmentId}/reprodukcija`)} />
              <ImportHost documentId={documentId} />
              <RulesHost role="student" />
              <MarksHost />
              <ReadAloudHost />
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
              ? <SubmittedBanner assignmentId={assignmentId} base={base} lead={submittedAt === null ? undefined : workText.submittedLead.replace("{at}", submittedAt)} />
              : frame.variant === "greska" ? null : <OfflineBanner />}
            stand={frame.variant === "greska" ? <ErrorCard failure={frameFailureOf(assignments, work)} onRetry={() => setAttempt((n) => n + 1)} /> : undefined}
            status={frame.variant === "greska"
              ? <FrameStatus chip={<SaveState state="ERROR" label={workText.errorStatus} />} />
              : frame.variant === "prazno"
                ? <FrameStatus chip={<SaveState state="LOCAL_DURABLE" label={workText.newWork} />} length={length} withNet />
                : frame.variant === "predano" && submittedAt !== null
                  ? <FrameStatus chip={<SaveState state="SYNCED" label={workText.submittedStatus.replace("{at}", submittedAt)} />} note={t.workspace.readOnly} length={length} />
                  : <StatusBar save={null} readOnly={frame.variant === "predano"} length={length} />}
            aside={frame.variant === "predano" && <>
              <ReadOnlyMentor role="student" submitted documentId={receipt?.documentId} submittedAt={receipt?.requestedAt} />
              {receipt?.documentId === undefined ? null : <DirectEditSettingHost documentId={receipt.documentId} here={here} submitted />}
              {receipt?.documentId === undefined ? null : <CommentsHost editor={null} documentId={receipt.documentId} session={null} submitted />}
            </>}
          >
            {sheetBody(frame.variant, assignmentId, title, () => setAttempt((n) => n + 1))}
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
      <EditorPage course={null} title={null} topBar={<WorkspaceTopBar assignmentId={assignmentId} base={base} title={null} inert />}
        stand={<LoadingCard />} status={<FrameStatus chip={<SaveState state="LOCAL_DURABLE" label={workText.loading} />} />}>
        {null}
      </EditorPage>
    );
  }
  return <>{shown.node}</>;
}
