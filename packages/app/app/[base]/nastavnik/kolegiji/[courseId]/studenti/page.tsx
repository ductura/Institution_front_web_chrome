import { Suspense } from "react";

import CourseStudents from "../../../../../../src/host/teacher/n04/CourseStudents";

/** N-04 "Popis studenata" (WEB-2143). */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <Suspense><CourseStudents courseId={courseId} /></Suspense>;
}
