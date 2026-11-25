import { notFound } from "next/navigation";

import TeamsPage from "../../../../../../src/host/teacher/work-team/TeamsPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Teacher: "Timovi na zadatku" (WEB-V19-GRUPA). A malformed id is the same 404 as another course's. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <TeamsPage key={assignmentId} assignmentId={assignmentId.toLowerCase()} />;
}
