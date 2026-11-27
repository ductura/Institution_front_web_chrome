import { notFound } from "next/navigation";

import CodeTestsPage from "../../../../../../src/host/teacher/code-tests/CodeTestsPage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Teacher: "Testovi uz zadatak" (WEB-V21-KOD-TESTOVI-OBRAZAC). A malformed id is the same 404 as another course's. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!uuid.test(assignmentId)) notFound();
  return <CodeTestsPage key={assignmentId} assignmentId={assignmentId.toLowerCase()} />;
}
