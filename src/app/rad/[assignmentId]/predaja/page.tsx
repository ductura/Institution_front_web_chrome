import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../client/api";
import { serverApi } from "../../../../client/server";
import { assignmentIdOf, editorWorkRead } from "../../../../components/editor/EditorPage.read";

export const dynamic = "force-dynamic";

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * `/rad/<assignmentId>/predaja` (WEB-26): no screen of its own, only the
 * step the submission stands at. A submitted work opens on step 5 (the
 * receipt); any other on step 2, where the declaration starts the flow. The
 * confirmation lives in the browser's tab only (P-7), so the server cannot
 * skip step 2. The assignment is checked as on every step.
 *
 * TODO(ugovor): the state comes from student.assignment-work.get until
 * student.submission.get is published (SRV-19, SRV-25).
 */
export default async function SubmissionStepPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const cookie = (await headers()).get("cookie") ?? "";
  const api = serverApi(cookie);
  const [assignments, work] = await Promise.all([
    api("student.assignments.get", NONE).catch(() => UNREACHED),
    api("student.assignment-work.get", NONE).catch(() => UNREACHED),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut") redirect(signInHref(`/rad/${assignmentId}/predaja`));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  const step = read.kind === "ready" && read.workState === "submitted" ? "potvrda" : "izjava";
  redirect(`/rad/${assignmentId}/predaja/${step}`);
}
