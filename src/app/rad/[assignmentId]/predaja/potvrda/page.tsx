import { Steps } from "@ductura/ui";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../../client/api";
import { serverApi } from "../../../../../client/server";
import { screenProvenance } from "../../../../../client/provenance-fake";
import { readSubmissionState, type LocalCall } from "../../../../../client/submission";
import { assignmentIdOf, editorWorkRead } from "../../../../../components/editor/EditorPage.read";
import { ProvenancePanel, readProvenance } from "../../../../../components/predaja/ProvenancePanel";
import { ReceiptPanel, studentReceiptRead } from "../../../../../components/predaja/ReceiptPanel";
import RoleShell from "../../../../../components/shell/RoleShell";
import { messagesHr as t } from "../../../../../lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.receipt.title} · ${t.app.name}` };

/** Both reads take no input. */
const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

/**
 * student.submission.get through src/client with the request's cookie (the
 * route is in the migration contract). createApi checks the answer against
 * the contract; readSubmissionState then checks the receipt itself. Only that
 * read goes this way, every other id stays unreachable here.
 */
function submissionCall(server: ReturnType<typeof serverApi>): LocalCall {
  return (id, { params }) => id === "student.submission.get"
    ? server("student.submission.get", { params, query: undefined, body: undefined }).catch(() => UNREACHED_CALL)
    : Promise.resolve(UNREACHED_CALL);
}
const UNREACHED_CALL = { ok: false, status: 0, code: "unavailable" } as const;

/**
 * TODO(ugovor): the entry-method share (WEB-1220) reads the in-memory fake
 * until the SRV-1220 proposal is approved and its route (SRV-1221) exists.
 */
const PROVENANCE = screenProvenance;

/**
 * `/rad/<assignmentId>/predaja/potvrda`: step 5 of the submission, "Potvrda"
 * (WEB-27, S: E-11). The assignment is checked as on the other steps through
 * src/client with the request's session cookie: signed out → AAI@EduHr
 * sign-in back here, notice not acknowledged → the notice, anyone else's or
 * unknown → 404. The receipt is read from the server on every request, so a
 * reload shows the same receipt.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId: raw } = await params;
  const assignmentId = assignmentIdOf(raw);
  if (assignmentId === null) notFound();
  const base = `/rad/${assignmentId}`;
  const here = `${base}/predaja/potvrda`;
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const server = serverApi(cookie);
  const [assignments, work, submission, provenance] = await Promise.all([
    server("student.assignments.get", NONE).catch(() => UNREACHED),
    server("student.assignment-work.get", NONE).catch(() => UNREACHED),
    readSubmissionState(submissionCall(server), assignmentId),
    readProvenance(PROVENANCE, assignmentId),
  ]);
  const read = editorWorkRead(assignmentId, assignments, work);
  if (read.kind === "signedOut" || submission.kind === "session-expired") redirect(signInHref(here));
  if (read.kind === "noticeFirst") redirect(`/zadatak/${assignmentId}`);
  if (read.kind === "notFound") notFound();
  const receipt = studentReceiptRead(submission, read.kind === "ready" ? read.workState : null);
  const crumbs = read.kind === "ready" ? [read.title, t.receipt.title] : [t.receipt.title];
  return (
    <RoleShell here={here} crumbs={crumbs}>
      <div className="page receipt-page">
        <Steps currentStep={5} />
        <h1>{t.receipt.title}</h1>
        <ReceiptPanel read={receipt} retryHref={here} summaryHref={`${base}/predaja/pregled`} submitHref={`${base}/predaja`} />
        <ProvenancePanel read={provenance} />
      </div>
    </RoleShell>
  );
}
