import WorkLanguagePage from "../../../../../../../../src/host/teacher/assignment/work-language";

export default async function Page({ params }: { params: Promise<{ assignmentId: string; documentId: string }> }) {
  const { assignmentId, documentId } = await params;
  return <WorkLanguagePage key={`${assignmentId}:${documentId}`} assignmentId={assignmentId} documentId={documentId} />;
}
