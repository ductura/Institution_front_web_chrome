import OriginPage from "../../../../../src/host/student/work/origin/OriginPage";

/** "Podrijetlo teksta" of the student's own work (P-1 rule 2.2, work.origin-composition.get); PIL-P1-SASTAV-STUDENT. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <OriginPage assignmentId={assignmentId} />;
}
