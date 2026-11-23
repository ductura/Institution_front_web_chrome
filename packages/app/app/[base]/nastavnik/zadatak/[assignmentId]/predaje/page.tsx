import { notFound } from "next/navigation";

import { TeacherSubmissionsPage } from "../../../../../../src/host/teacher/submissions/SubmissionsPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Predaje zadatka" (PIL-D2-PREDAJE over WEB-1502): the submissions of one assignment. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <TeacherSubmissionsPage assignmentId={assignmentId.toLowerCase()} />;
}
