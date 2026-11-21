import NoticePage from "../../../../src/host/student/notice/NoticePage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoticePage key={id} assignmentId={id} />;
}
