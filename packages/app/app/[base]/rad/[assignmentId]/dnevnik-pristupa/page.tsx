import { cursorOf } from "../../../../../../../src/components/student/access-log-read";
import { AccessLogPage } from "../../../../../src/host/student/other";

/** "Dnevnik pristupa": who opened the student's work (S-42, student.access-log.get); HOST-S5. */
export default async function Page({ params, searchParams }: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assignmentId } = await params;
  return <AccessLogPage assignmentId={assignmentId} cursor={cursorOf(await searchParams)} />;
}
