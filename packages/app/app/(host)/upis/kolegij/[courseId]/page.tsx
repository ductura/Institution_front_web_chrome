import { notFound } from "next/navigation";

import { EnrolledCoursePage } from "../../../../../src/host/student/enrollment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The step between enrolment and the notice (PRODUCT §5 rule 6); HOST-S3. */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!uuid.test(courseId)) notFound();
  return <EnrolledCoursePage courseId={courseId.toLowerCase()} />;
}
