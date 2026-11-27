import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../../client/api";
import { serverApi } from "../../../../../client/server";
import { assignmentIdOf, editorWorkRead } from "../../../../../components/editor/EditorPage.read";
import { readAssignmentsWithMentored } from "../../../../../components/student/mentored-assignments";
import BeforeSubmit, { type SummaryRead } from "../../../../../components/predaja/BeforeSubmit";
import { DECLARED_PARAM } from "../../../../../components/predaja/flow";
import { stageOf, type Stage } from "../../../../../components/predaja/stage";
import { DeniedState } from "../../../../../components/shell/LoadAlert";
import RoleShell from "../../../../../components/shell/RoleShell";
import { messagesHr as t } from "../../../../../lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.beforeSubmit.title}, ${t.app.name}` };

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * TODO(ugovor): the student's read of the process summary (SRV-23) and the
 * notes (SRV-24) are not in the published contract yet, so nothing is called
 * for them: the summary reads as not loadable, with nothing to try again, and the notes as unavailable,
 * neither of which holds the flow (§5 rule 11). On the contract's release
 * both become reads through src/client.
 */
const SUMMARY: SummaryRead = { kind: "unavailable" };

/**
 * `/rad/<assignmentId>/predaja/pregled`: step 3 of the submission, "Prije
 * predaje" (WEB-25, S: E-8). The assignment is checked as on `/rad/<id>`
 * through src/client with the request's session cookie: signed out →
 * AAI@EduHr sign-in back here, notice not acknowledged → the notice, anyone
 * else's or unknown → 404.
 */
export default async function BeforeSubmitPage({ params, searchParams }: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assignmentId: raw } = await params;
  const handed = (await searchParams)[DECLARED_PARAM];
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const here = `/rad/${assignmentId}/predaja/pregled`;
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
    return <RoleShell here={here} crumbs={[t.beforeSubmit.title]}><div className="page"><DeniedState /></div></RoleShell>;
  }
  const stage: Stage = read.kind === "ready" ? stageOf(read.workState, read.dueAt, Date.now()) : { kind: "unavailable" };
  const crumbs = read.kind === "ready" ? [read.title, t.beforeSubmit.title] : [t.beforeSubmit.title];
  return (
    <RoleShell here={here} crumbs={crumbs}>
      <BeforeSubmit assignmentId={assignmentId} summary={SUMMARY} stage={stage}
        declaredFor={typeof handed === "string" ? handed : undefined} />
    </RoleShell>
  );
}
