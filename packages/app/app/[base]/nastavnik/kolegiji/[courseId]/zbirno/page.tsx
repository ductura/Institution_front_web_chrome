import { Suspense } from "react";

import CourseAggregatePage from "../../../../../../src/host/teacher/course-aggregate/CourseAggregatePage";

/** "Zbirni pregled kolegija" over course.aggregate.get (PIL-K-ZBIRNO), reached from N-04. */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <Suspense><CourseAggregatePage courseId={courseId} /></Suspense>;
}
