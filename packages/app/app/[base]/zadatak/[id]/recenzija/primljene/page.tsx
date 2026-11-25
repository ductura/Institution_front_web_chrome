import { notFound } from "next/navigation";

import ReceivedPage from "../../../../../../src/host/student/peer-review/ReceivedPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Student: "Primljene recenzije" (WEB-V19-RECENZIJA-STUDENT). A malformed id is the same 404 as another course's. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <ReceivedPage key={id} assignmentId={id.toLowerCase()} />;
}
