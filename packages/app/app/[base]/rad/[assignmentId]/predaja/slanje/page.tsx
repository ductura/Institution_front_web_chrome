import { SubmitStepPage } from "../../../../../../src/host/student/submission";

/** Step 4, "Predaja" (WEB-26); HOST-S2. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <SubmitStepPage assignmentId={assignmentId} />;
}
