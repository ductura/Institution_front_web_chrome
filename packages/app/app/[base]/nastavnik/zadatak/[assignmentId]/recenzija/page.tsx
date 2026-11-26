import { notFound } from "next/navigation";

import OverviewPage from "../../../../../../src/host/teacher/peer-review/OverviewPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Teacher: "Recenzija među studentima" (WEB-V19-RECENZIJA-NASTAVNIK). A malformed id is the same 404 as another course's. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <OverviewPage key={assignmentId} assignmentId={assignmentId.toLowerCase()} />;
}
