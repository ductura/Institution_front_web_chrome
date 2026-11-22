import { isWorkId } from "../../../../components/teacher/LiveWorkFrame";
import LiveWorkView from "../../../../components/teacher/LiveWorkView";
import { messagesHr } from "../../../../lib/i18n/messages.hr";

export const dynamic = "force-dynamic";
export const metadata = { title: `${messagesHr.liveView.context} · ${messagesHr.app.name}` };

/**
 * `/nastavnik/rad/[id]` (WEB-34, N-06): the teacher's read-only live view of
 * one work. The shell (layout) has already read the session and the role;
 * who may read the work is decided by the live route on every request
 * (BACKEND 4.12 t. 4), so this page renders no text of the work on the
 * server. Replaces the parked page that read the database through withActor.
 *
 * The live text and the process summary are read in the browser by
 * `LiveWorkView` (live.document.get, projection.process-summary.post).
 * The heading and the neighbours are read in the browser by `LiveWorkView`
 * (teacher.work.get).
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
      <LiveWorkView documentId={id} />
    </div>
  );
}
