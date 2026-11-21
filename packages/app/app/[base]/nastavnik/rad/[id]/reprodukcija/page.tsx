import { TeacherWorkPage } from "../../../../../../src/host/teacher/work/pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherWorkPage documentId={id} view="replay" />;
}
