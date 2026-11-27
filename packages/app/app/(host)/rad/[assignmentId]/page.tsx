import { WorkEditorPage } from "../../../../src/host/student/WorkEditorPage";

/** The student's work on one assignment: the editor (WEB-14, WEB-23); HOST-S1. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  // A malformed id reads as not found inside the page, as editorWorkRead decides.
  return <WorkEditorPage assignmentId={assignmentId} />;
}
