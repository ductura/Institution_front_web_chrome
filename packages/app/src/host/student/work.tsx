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

import { hostText } from "../../text";
import { nextPath } from "../../bases";
import { useHost } from "../context";
import { EditorSessionControls } from "../editor/save-status/EditorSessionControls";
import { ImportHost } from "../editor/import/ImportHost";
import PdfExport from "../editor/export/PdfExport";
import { PregledGroup } from "../editor/right/PregledGroup";
import { unavailableTransport } from "../../../../../src/client/import.ts";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/** What the sheet holds when no editor is mounted. */
function sheetBody(variant: WorkspaceVariant): ReactNode {
  if (variant === "greska") return <SheetNote>{t.student.unavailable}</SheetNote>;
  if (variant === "predano") return <SheetNote>{t.editor.submittedReadOnly}</SheetNote>;
  if (variant === "prazno") return <SheetNote>{t.workspace.notStarted}</SheetNote>;
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
  useEffect(() => {
    let live = true;
    const here = appHref(base, `/rad/${assignmentId}`);
    void (async () => {
      const client = createApi();
      const [assignments, work] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
      ]);
      if (!live) return;
      const read = editorWorkRead(assignmentId, assignments as never, work as never);
      if (read.kind === "signedOut") return goToSignIn(here);
      if (read.kind === "noticeFirst") return router.replace(nextPath(base, `/zadatak/${assignmentId}`));
      if (read.kind === "notFound") return setShown({ kind: "notFound" });
      const frame = workspaceFrame(read);
      const title = read.kind === "ready" ? read.title : null;
      const topBar = <WorkspaceTopBar assignmentId={assignmentId} title={title} />;
      const length = { words: null, range: frame.range };
      if (read.kind === "ready" && frame.variant === "puno") {
        return setShown({
          kind: "page",
          node: <EditorPageWork assignmentId={assignmentId} course={read.course} title={read.title} topBar={topBar} length={length}
            renderReview={({ editor, documentId }) => <PregledGroup editor={editor} documentId={documentId} />}
            renderPdf={(version) => <PdfExport assignmentId={assignmentId} version={version} here={`/rad/${assignmentId}`} />}
            sessionControls={({ scope, session }) => <>
              <EditorSessionControls scope={scope} session={session} assignmentId={assignmentId} />
              <ImportHost assignmentId={assignmentId} transport={unavailableTransport} />
            </>} />,
        });
      }
      const submission = frame.variant === "predano"
        ? await readSubmittedWork(assignmentId, { baseUrl: window.location.origin, fetchImpl: browserTransport })
        : null;
      if (!live) return;
      if (submission?.kind === "session-expired") return goToSignIn(here);
      const receipt = submission?.kind === "potvrdeno" ? submission.receipt.payload : undefined;
      setShown({
        kind: "page",
        node: (
          <EditorPage
            course={read.kind === "ready" ? read.course : null}
            title={title}
            topBar={topBar}
            status={<StatusBar save={null} readOnly={frame.variant === "predano"} length={length} />}
            aside={frame.variant === "predano" && <ReadOnlyMentor role="student" submitted
              documentId={receipt?.documentId} submittedAt={receipt?.requestedAt} />}
          >
            {sheetBody(frame.variant)}
          </EditorPage>
        ),
      });
    })();
    return () => {
      live = false;
    };
  }, [assignmentId, base]);
  if (shown.kind === "notFound") notFound();
  if (shown.kind === "loading") return <p role="status">{hostText.loading}</p>;
  return <>{shown.node}</>;
}
