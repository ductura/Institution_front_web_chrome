import { Suspense } from "react";

import CourseStudents from "@/components/teacher/CourseStudents";
import { courseStudentsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

export const metadata = { title: `${t.title}, ${messagesHr.app.name}` };

type Props = { params: Promise<{ courseId: string }> };

async function Roster({ params }: Props) {
  const { courseId } = await params;
  const href = `/nastavnik/kolegiji/${encodeURIComponent(courseId)}/studenti`;

  // TODO(ugovor): connect the validated WEB-30 read once SRV-29 and the
  // published contract are available. An unavailable roster is not empty.
  return <CourseStudents result={{ kind: "unavailable", retryHref: href }} />;
}

export default function CourseStudentsPage({ params }: Props) {
  return (
    <Suspense fallback={<CourseStudents result={{ kind: "loading" }} />}>
      <Roster params={params} />
    </Suspense>
  );
}
