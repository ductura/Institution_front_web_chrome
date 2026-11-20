import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../../client/api";
import { serverApi } from "../../../../../client/server";
import { assignmentIdOf, editorWorkRead } from "../../../../../components/editor/EditorPage.read";
import Declaration, { type RecordedRead } from "../../../../../components/predaja/Declaration";
import RoleShell from "../../../../../components/shell/RoleShell";
import { messagesHr as t } from "../../../../../lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.declaration.title} · ${t.app.name}` };

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * TODO(ugovor): the student's read of the process summary (SRV-23) is not in
 * the published contract yet, so nothing is called for it and the block reads
 * as not loadable. That never holds the flow (§5 rule 11). On the contract's
 * release this becomes the read through src/client.
 */
const RECORDED: RecordedRead = { kind: "error" };

/**
 * `/rad/<assignmentId>/predaja/izjava`: step 2 of the submission, "Izjava"
 * (WEB-24, S: E-9). The assignment is checked as on `/rad/<id>` through
 * src/client (student.assignments.get, student.assignment-work.get) with the
 * request's session cookie: signed out → AAI@EduHr sign-in back here, notice
 * not acknowledged → the notice, anyone else's or unknown → 404. When the
 * reads do not answer, the step is not shown: the notice may not be
 * acknowledged yet (PRODUCT §5 rule 6).
 */
export default async function DeclarationPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const here = `/rad/${assignmentId}/predaja/izjava`;
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const api = serverApi(cookie);
  const [assignments, work] = await Promise.all([
    api("student.assignments.get", NONE).catch(() => UNREACHED),
    api("student.assignment-work.get", NONE).catch(() => UNREACHED),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut") redirect(signInHref(here));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  if (read.kind !== "ready") {
    return (
      <RoleShell here={here} crumbs={[t.declaration.title]}>
        <div className="page declaration">
          <h1>{t.declaration.title}</h1>
          <p role="status">{t.student.unavailable}</p>
        </div>
      </RoleShell>
    );
  }
  return (
    <RoleShell here={here} crumbs={[read.title, t.declaration.title]}>
      <Declaration assignmentId={assignmentId} recorded={RECORDED} />
    </RoleShell>
  );
}
