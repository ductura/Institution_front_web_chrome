import { ReplayPage } from "../../../../../src/host/student/other";

/** "Reprodukcija Vašeg rada" (S-34, evidence.replay.post); HOST-S5. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <ReplayPage assignmentId={assignmentId} />;
}
