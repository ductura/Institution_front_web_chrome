import { notFound } from "next/navigation";

import { DeadlineExtensionsPage } from "../../../../../../src/host/teacher/overview";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** N-13 "Produljenje roka" (WEB-1113 over SRV-1108); HOST-T3. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <DeadlineExtensionsPage assignmentId={assignmentId.toLowerCase()} />;
}
