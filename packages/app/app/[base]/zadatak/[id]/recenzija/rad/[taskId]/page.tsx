import { notFound } from "next/navigation";

import ReviewPage from "../../../../../../../src/host/student/peer-review/ReviewPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Student: "Recenzija rada" (WEB-V19-RECENZIJA-STUDENT). A malformed id is the same 404 as another student's work. */
export default async function Page({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  if (!uuid.test(id) || !uuid.test(taskId)) notFound();
  return <ReviewPage key={taskId} assignmentId={id.toLowerCase()} taskId={taskId.toLowerCase()} />;
}
