import LiveWorkView, { isWorkId } from "@/components/teacher/LiveWorkView";
import RecordLimits from "@/components/teacher/RecordLimits";
import { messagesHr } from "@/lib/i18n/messages.hr";

const t = messagesHr.teacherLiveWork;

export const dynamic = "force-dynamic";
export const metadata = { title: `${messagesHr.liveView.context} · ${messagesHr.app.name}` };

/**
 * `/nastavnik/rad/[id]` (WEB-34, N-06): the teacher's read-only live view of
 * one work. The shell (layout) has already read the session and the role;
 * who may read the work is decided by the live route on every request
 * (BACKEND 4.12 t. 4), so this page renders no text of the work on the
 * server. Replaces the parked page that read the database through withActor.
 *
 * TODO(ugovor): the live text (`LiveText` over live.document.get), the
 * summary (`SummaryCard`, `recordState`) and the frame are mounted once their
 * readers are in src/client (Ductus#2028, wweb34 PITANJE); until then the
 * frame is `null` and the text slot says the live text is not available.
 */
export default async function LiveWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWorkId(id)) {
    return (
      <div className="page">
        <h1>{messagesHr.liveView.context}</h1>
        <p role="status">{messagesHr.liveView.invalid}</p>
      </div>
    );
  }
  return (
    <div className="page">
      <LiveWorkView
        documentId={id}
        frame={null}
        recordState={null}
        text={<p role="status" className="manuscript__placeholder">{t.textPending}</p>}
        aside={<RecordLimits />}
      />
    </div>
  );
}
