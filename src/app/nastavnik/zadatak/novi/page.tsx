import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInHref } from "@/client/api";
import { serverApi } from "@/client/server";
import TeacherSetup from "@/components/teacher/TeacherSetup";
import { assignmentSetupMessages } from "@/components/teacher/TeacherSetup/messages.hr";
import { newAssignmentHref } from "@/components/teacher/links";
import { readTeacherCourses, type TeacherCourse } from "@/components/teacher/teacher-courses-read";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "../../page.module.css";

const t = messagesHr.teacher.existingCourse;
const path = "/nastavnik/zadatak/novi";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

export default async function NewAssignmentPage({ searchParams }: {
  searchParams: Promise<{ kolegij?: string | string[] }>;
}) {
  const { kolegij } = await searchParams;
  const id = typeof kolegij === "string" && uuid.test(kolegij) ? kolegij.toLowerCase() : undefined;
  const read = await readTeacherCourses(serverApi((await cookies()).toString()));
  if (read.kind === "signedOut") redirect(signInHref(id ? newAssignmentHref(id) : path));

  let body;
  if (read.kind !== "ready") {
    body = <p role="alert">{read.kind === "unavailable" ? t.unavailable : t.missing}</p>;
  } else if (kolegij === undefined) {
    body = <CourseSelection courses={read.courses} />;
  } else {
    const course = read.courses.find((course) => course.id.toLowerCase() === id);
    body = course ? <TeacherSetup key={course.id} course={course} /> : (
      <>
        <p role="alert">{t.missing}</p>
        <p><Link href={path}>{assignmentSetupMessages.choose}</Link></p>
      </>
    );
  }

  return (
    <div className={`page ${styles.page}`}>
      <h1>{t.title}</h1>
      {body}
      <p><Link href="/nastavnik">{messagesHr.teacher.backCourses}</Link></p>
    </div>
  );
}

function CourseSelection({ courses }: { courses: TeacherCourse[] }) {
  if (!courses.length) return <p>{messagesHr.teacherCourseCodes.emptyNext}</p>;
  return (
    <section aria-labelledby="odabir-kolegija">
      <h2 id="odabir-kolegija">{assignmentSetupMessages.choose}</h2>
      <ul>{courses.map(({ id, name, academicYear }) => (
        <li key={id}><Link href={newAssignmentHref(id)}>{name} · {academicYear}</Link></li>
      ))}</ul>
    </section>
  );
}
