import { notFound } from "next/navigation";

import { SubmissionsPage } from "../../../../../../src/host/teacher/submissions/SubmissionsPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** M7.2 "Predaje zadatka": the table of submissions and the read-only view of a submitted version. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <SubmissionsPage assignmentId={assignmentId.toLowerCase()} />;
}
