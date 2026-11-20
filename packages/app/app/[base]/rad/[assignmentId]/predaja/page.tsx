import { SubmissionStartPage } from "../../../../../src/host/student/submission";

/** "Predaja rada": opens the step the submission stands at; HOST-S2. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <SubmissionStartPage assignmentId={assignmentId} />;
}
