import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { cookieTransport, signInHref } from "../../../client/api";
import { institutionServerUrl, serverApi } from "../../../client/server";
import EditorPage, { SheetNote } from "../../../components/editor/EditorPage";
import { assignmentIdOf, editorWorkRead } from "../../../components/editor/EditorPage.read";
import { readAssignmentsWithMentored } from "../../../components/student/mentored-assignments";
import EditorPageWork from "../../../components/editor/EditorPageWork";
import { ReadOnlyMentor } from "../../../components/editor/mentor/work-state/ReadOnlyMentor";
import { readSubmittedWork } from "../../../components/editor/mentor/work-state/submitted-work-read";
import StatusBar from "../../../components/editor/StatusBar";
import WorkspaceTopBar from "../../../components/editor/WorkspaceTopBar";
import { workspaceFrame, type WorkspaceVariant } from "../../../components/editor/workspace-variant";
import { messagesHr as t } from "../../../lib/i18n/messages.hr";

export const metadata = {
  title: `${t.workspace.title} · ${t.app.name}`,
};

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

// The session cookie is read per request: nothing of a student's work is built in.
export const dynamic = "force-dynamic";

/** What the sheet holds when no editor is mounted. */
function sheetBody(variant: WorkspaceVariant) {
  // The server could not answer: say so, never that the assignment is not this account's.
  if (variant === "greska") return <SheetNote>{t.student.unavailable}</SheetNote>;
  if (variant === "predano") return <SheetNote>{t.editor.submittedReadOnly}</SheetNote>;
  if (variant === "prazno") return <SheetNote>{t.workspace.notStarted}</SheetNote>;
  return (
    <SheetNote>
      {t.workspace.documentNotEditable} <span className="soon">{t.workspace.soon}</span>
    </SheetNote>
  );
}

/**
 * `/rad/<assignmentId>`: the student's work on one assignment (WEB-14). The
 * page reads the assignment and the state of the work through src/client only
 * (student.assignments.get, student.assignment-work.get), with the request's
 * session cookie. Signed out → AAI@EduHr sign-in, back here; a notice not yet
 * acknowledged → the notice first; anyone else's or an unknown assignment →
 * 404. A work in progress mounts EditorPageWork. No save state is claimed
 * while no journal is open.
 *
 * WEB-23 (S: E-7) frames the sheet: the top bar with "Predaja rada" and the
 * sheet switch, and the status bar with the scope line. A submitted work is
 * read only. TODO(ugovor): student.submission.get and
 * student.assignment-requirements.get are not published yet (SRV-19, SRV-22),
 * so the frame comes from the work state alone and the range is not shown.
 */
export default async function WorkPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const here = `/rad/${assignmentId}`;
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const api = serverApi(cookie);
  // A server that cannot be reached is an unavailable read, not an error page.
  const [assignments, work] = await Promise.all([
    readAssignmentsWithMentored(api),
    api("student.assignment-work.get", NONE).catch(() => UNREACHED),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut") redirect(signInHref(here));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  const frame = workspaceFrame(read);
  const title = read.kind === "ready" ? read.title : null;
  const topBar = <WorkspaceTopBar assignmentId={assignmentId} title={title} />;
  const length = { words: null, range: frame.range };
  // "not_started" waits for the read of work-document-plan over /api/v1.
  if (read.kind === "ready" && frame.variant === "puno") {
    return <EditorPageWork assignmentId={assignmentId} course={read.course} title={read.title} topBar={topBar} length={length} />;
  }
  const submission = frame.variant === "predano"
    ? await readSubmittedWork(assignmentId, { baseUrl: institutionServerUrl(), fetchImpl: cookieTransport(cookie) })
    : null;
  if (submission?.kind === "session-expired") redirect(signInHref(here));
  const receipt = submission?.kind === "potvrdeno" ? submission.receipt.payload : undefined;
  return (
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
  );
}
