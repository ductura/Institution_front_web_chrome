import { notFound, redirect } from "next/navigation";

import { signInHref } from "../../../../../client/api";
import { screenProvenance } from "../../../../../client/provenance-fake";
import type { TeacherCall } from "../../../../../client/teacher-reads";
import { ProvenancePanel, readProvenance } from "../../../../../components/predaja/ProvenancePanel";
import { ReceiptPanel } from "../../../../../components/predaja/ReceiptPanel";
import { liveWorkHref, submissionHref, SUMMARY_ANCHOR } from "../../../../../components/teacher/LiveWorkFrame";
import { messagesHr as t } from "../../../../../lib/i18n/messages.hr";

import { loadTeacherReceipt, type WorkCall } from "./teacher-receipt";

export const dynamic = "force-dynamic";
export const metadata = { title: `${t.receipt.title}, ${t.app.name}` };

/**
 * TODO(ugovor): teacher.work.get and teacher.submission-receipt.get are not
 * in the published contract yet (teacher-receipt.ts). Until then there is no
 * transport, both read as unknown and the page shows the error variant,
 * never "predano" (B-6). On the release these become reads through src/client.
 */
const WORK: WorkCall | undefined = undefined;
const RECEIPT: TeacherCall | undefined = undefined;
/** TODO(ugovor): the same fake as the student's step 5 until SRV-1220 is approved (WEB-1220). */
const PROVENANCE = screenProvenance;

/**
 * `/nastavnik/rad/[id]/predaja` (WEB-35, N-07): the receipt of a submitted
 * work as the teacher sees it, the same `ReceiptPanel` and the same words as
 * the student's step 5 (PRODUCT §5 rule 5). The shell (layout) has already
 * read the session and the role; who may read this work is decided by the
 * server on every request: signed out → AAI@EduHr sign-in back here, another
 * teacher's or unknown → 404. Not built here: the declaration block
 * (`declPanel`), QR and the link to /provjera (wave 9).
 */
/** "Rad uživo: {ime studenta}", or "Rad uživo" when the name is not known. */
function backLabel(name: string | null | undefined): string {
  return name ? t.teacherLiveWork.untitledFor.replace("{name}", () => name) : t.teacherLiveWork.untitled;
}

export default async function TeacherReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const live = liveWorkHref(id);
  const here = submissionHref(id);
  if (live === null || here === null) {
    return (
      <div className="page">
        <h1>{t.receipt.title}</h1>
        <p role="status">{t.liveView.invalid}</p>
      </div>
    );
  }
  const [view, provenance] = await Promise.all([loadTeacherReceipt(WORK, RECEIPT, id), readProvenance(PROVENANCE, id)]);
  if (view.kind === "signedOut") redirect(signInHref(here));
  if (view.kind === "notFound") notFound();
  return (
    <div className="page receipt-page">
      <p><a href={live}>{backLabel(view.work?.studentName)}</a></p>
      <h1>{t.receipt.title}</h1>
      {view.work?.studentName ? <p>{view.work.studentName}</p> : null}
      <ReceiptPanel read={view.read} retryHref={here} summaryHref={`${live}#${SUMMARY_ANCHOR}`} />
      <ProvenancePanel read={provenance} />
    </div>
  );
}
