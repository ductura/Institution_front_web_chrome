import TeacherViewPage from "../../../../../src/host/student/work/teacher-view/TeacherViewPage";

/** "Kako vidi nastavnik": the student's own work, read only (F4-EDI-R14). */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <TeacherViewPage assignmentId={assignmentId} />;
}
