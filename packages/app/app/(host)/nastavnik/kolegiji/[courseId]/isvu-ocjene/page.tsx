import IsvuGradesRoute from "../../../../../../src/host/teacher/isvu-grades/IsvuGradesRoute";

/** WEB-V22-RUTE: the trial grade export of one course (teacher of the course). */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <IsvuGradesRoute courseId={courseId} />;
}
