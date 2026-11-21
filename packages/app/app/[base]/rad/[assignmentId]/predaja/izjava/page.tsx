import { DeclarationStepPage } from "../../../../../../src/host/student/submission";

/** Step 2, "Izjava" (WEB-24); HOST-S2. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <DeclarationStepPage assignmentId={assignmentId} />;
}
