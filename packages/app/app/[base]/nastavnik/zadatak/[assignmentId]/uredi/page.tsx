import AssignmentVersionPage from "../../../../../../src/host/teacher/assignment/assignment-version";

export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <AssignmentVersionPage key={assignmentId} assignmentId={assignmentId} />;
}
