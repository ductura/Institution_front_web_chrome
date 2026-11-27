"use client";

import Link from "next/link";

import { routerPath } from "../../../bases";

import { createApi } from "@/client/api";
import { newAssignmentHref } from "@/components/teacher/links";
import { yearHr } from "@/components/teacher/TeacherCourses";
import { readTeacherCourses } from "@/components/teacher/teacher-courses-read";
import { assignmentSetupHr, messagesHr } from "@/lib/i18n/messages.hr";

import AssignmentForm from "../assignment-form/AssignmentForm";

import { AssignmentPage, useAssignmentRead } from "./page-state";

const path = "/nastavnik/zadatak/novi";
const t = messagesHr.teacher.existingCourse;

export default function NewAssignmentPage({ courseId }: { courseId?: string | string[] }) {
  const [read, retry] = useAssignmentRead(path, async () => {
    const courses = await readTeacherCourses(createApi());
    return courses.kind === "ready" ? { kind: "ready", value: courses.courses } : courses;
  });

  return (
    <AssignmentPage title={t.title} read={read} retry={retry} unavailable={t.unavailable}>
      {(courses, href) => {
        if (courseId !== undefined) {
          const selected = typeof courseId === "string" && courses.find((course) => course.id.toLowerCase() === courseId.toLowerCase());
          return selected ? <AssignmentForm key={selected.id} course={selected} cancelHref={href("/nastavnik")} /> : (
            <>
              <p role="alert">{t.missing}</p>
              <p><a href={href(path)}>{assignmentSetupHr.choose}</a></p>
            </>
          );
        }
        if (courses.length === 0) return <p role="status">{messagesHr.teacherCourseCodes.emptyNext}</p>;
        return (
          <section aria-labelledby="odabir-kolegija">
            <h2 id="odabir-kolegija">{assignmentSetupHr.choose}</h2>
            <ul>{courses.map(({ id, name, academicYear }) => (
              <li key={id}><Link href={routerPath(href(newAssignmentHref(id)))}>{name}, {yearHr(academicYear)}</Link></li>
            ))}</ul>
          </section>
        );
      }}
    </AssignmentPage>
  );
}
