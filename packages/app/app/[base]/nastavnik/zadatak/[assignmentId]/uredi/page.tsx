import { Suspense } from "react";

import AssignmentVersionPage from "../../../../../../src/host/teacher/assignment/assignment-version";

// NZ-1: the page reads `?kopiraj=1` (useSearchParams), so it renders inside Suspense.
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <Suspense><AssignmentVersionPage key={assignmentId} assignmentId={assignmentId} /></Suspense>;
}
