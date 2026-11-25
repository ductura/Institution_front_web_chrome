import { notFound } from "next/navigation";

import TeamPage from "../../../../../src/host/student/work-team/TeamPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Student: "Moj tim" (WEB-V19-GRUPA). A malformed id is the same 404 as another course's. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <TeamPage key={id} assignmentId={id.toLowerCase()} />;
}
