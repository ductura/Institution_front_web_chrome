import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../client/api";
import { serverApi } from "../../../client/server";
import EditorPage, { SheetNote } from "../../../components/editor/EditorPage";
import { assignmentIdOf, editorWorkRead, type EditorWorkRead } from "../../../components/editor/EditorPage.read";
import StatusBar from "../../../components/editor/StatusBar";
import { messagesHr as t } from "../../../lib/i18n/messages.hr";

export const metadata = {
  title: `${t.workspace.title} · ${t.app.name}`,
};

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

// The session cookie is read per request: nothing of a student's work is built in.
export const dynamic = "force-dynamic";

/** What the sheet holds until the editor-core journal is wired (WEB-14 part 2). */
function sheetBody(read: Extract<EditorWorkRead, { kind: "ready" | "unavailable" }>) {
  // The server could not answer: say so, never that the assignment is not this account's.
  if (read.kind === "unavailable") return <SheetNote>{t.student.unavailable}</SheetNote>;
  if (read.workState === "submitted") return <SheetNote>{t.editor.submittedReadOnly}</SheetNote>;
  if (read.workState === "not_started") return <SheetNote>{t.workspace.notStarted}</SheetNote>;
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
 * 404. No save state is claimed while no journal is open.
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
    api("student.assignments.get", NONE).catch(() => UNREACHED),
    api("student.assignment-work.get", NONE).catch(() => UNREACHED),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut") redirect(signInHref(here));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  return (
    <EditorPage
      course={read.kind === "ready" ? read.course : null}
      title={read.kind === "ready" ? read.title : null}
      status={<StatusBar save={null} />}
    >
      {sheetBody(read)}
    </EditorPage>
  );
}
