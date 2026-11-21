import { ReceiptStepPage } from "../../../../../../src/host/student/submission";

/** Step 5, "Potvrda" (WEB-27); HOST-S2. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <ReceiptStepPage assignmentId={assignmentId} />;
}
