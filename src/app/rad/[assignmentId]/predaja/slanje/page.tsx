import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../../client/api";
import { serverApi } from "../../../../../client/server";
import { assignmentIdOf, editorWorkRead } from "../../../../../components/editor/EditorPage.read";
import { readAssignmentsWithMentored } from "../../../../../components/student/mentored-assignments";
import { stageOf, type Stage } from "../../../../../components/predaja/stage";
import { DeniedState } from "../../../../../components/shell/LoadAlert";
import RoleShell from "../../../../../components/shell/RoleShell";
import Submission from "../../../../../components/student/Submission";
import { messagesHr as t } from "../../../../../lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.submit.title}, ${t.app.name}` };

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * `/rad/<assignmentId>/predaja/slanje`: step 4 of the submission, "Predaja"
 * (WEB-26, S: E-10). The assignment is checked as on the other steps through
 * src/client with the request's session cookie: signed out → AAI@EduHr
 * sign-in back here, notice not acknowledged → the notice, anyone else's or
 * unknown → 404, already submitted → step 5. The deadline (variant
 * nakonroka) is from student.assignments.get, shown before anything is sent.
 */
export default async function SubmitPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const here = `/rad/${assignmentId}/predaja/slanje`;
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const call = serverApi(cookie);
  const [assignments, work] = await Promise.all([
    readAssignmentsWithMentored(call),
    call("student.assignment-work.get", NONE).catch(() => UNREACHED),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut") redirect(signInHref(here));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  // Design alignment 27. 11. 2026. (S-08): 403 is no access (X1), never the load alert.
  if (read.kind === "denied") {
    return <RoleShell here={here} crumbs={[t.submit.title]}><div className="page"><DeniedState /></div></RoleShell>;
  }
  const stage: Stage = read.kind === "ready" ? stageOf(read.workState, read.dueAt, Date.now()) : { kind: "unavailable" };
  if (stage.kind === "submitted") redirect(`/rad/${assignmentId}/predaja/potvrda`);
  const crumbs = read.kind === "ready" ? [read.title, t.submit.title] : [t.submit.title];
  return (
    <RoleShell here={here} crumbs={crumbs}>
      <Submission assignmentId={assignmentId} stage={stage} />
    </RoleShell>
  );
}
