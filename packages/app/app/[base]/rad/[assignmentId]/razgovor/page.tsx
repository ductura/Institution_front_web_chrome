import StudentInterviewPage from "../../../../../src/host/student/interview/StudentInterviewPage";

/** The student's side of the teacher's interview preparation (work.interview.get, N-14); PIL-K-RAZGOVOR. */
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return <StudentInterviewPage assignmentId={assignmentId} />;
}
