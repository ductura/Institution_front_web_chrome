import { notFound } from "next/navigation";

import { MerlinExportPage } from "../../../../../../src/host/teacher/merlin/MerlinPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** N-18 "Izvoz za Merlin" (WEB-2163). */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <MerlinExportPage assignmentId={assignmentId.toLowerCase()} />;
}
