import { Suspense } from "react";

import CourseStudentsPage from "../../../../../../src/host/teacher/n04/CourseStudentsPage";

/** N-04 "Popis studenata" (WEB-2143) over the real port (PIL-K-N04). */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <Suspense><CourseStudentsPage courseId={courseId} /></Suspense>;
}
