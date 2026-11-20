"use client";

import { Button, Dialog, Select } from "@ductura/ui";
import { useEffect, useState } from "react";
import { createApi } from "../../../client/api";
import { readRoster, type RosterStudent } from "../../editor/mentor/timeline/work-timeline";
import { readTeacherCourses, type TeacherCourse, type TeacherCoursesRead } from "../teacher-courses-read";
import { mentoredStudentsHr as t } from "./messages.hr";

export function availableMentorCourses(role: "student" | "teacher", read: TeacherCoursesRead | undefined) {
  return role === "teacher" && read?.kind === "ready" ? read.courses : [];
}

function CourseRoster({ course }: { course: TeacherCourse }) {
  const [students, setStudents] = useState<RosterStudent[] | null>();
  useEffect(() => {
    let live = true;
    void readRoster(course.id).then((read) => { if (live) setStudents(read); });
    return () => { live = false; };
  }, [course.id]);

  if (students === undefined) return <p role="status">{t.loading}</p>;
  if (students === null) return <p role="alert">{t.unavailable}</p>;
  if (!students.length) return <p role="status">{t.empty}</p>;
  const titles = new Map(course.assignments.map((assignment) => [assignment.id, assignment.title]));
  return <ul>
    {students.map((student) => <li key={student.studentId}>
      <strong>{[student.givenName, student.familyName].filter(Boolean).join(" ") || t.noName}</strong>
      {student.groupName && <> · {student.groupName}</>}
      {student.assignments.length ? <ul>
        {student.assignments.map((assignment) => <li key={assignment.assignmentId}>
          {titles.get(assignment.assignmentId) ?? t.assignment} · {t.state[assignment.workState]}
        </li>)}
      </ul> : <p>{t.noAssignments}</p>}
    </li>)}
  </ul>;
}

export function MentoredStudents({ role }: { role: "student" | "teacher" }) {
  const [courseRead, setCourseRead] = useState<TeacherCoursesRead>();
  const [selected, setSelected] = useState<string>();
  useEffect(() => {
    if (role !== "teacher") return;
    let live = true;
    void readTeacherCourses(createApi()).then((result) => { if (live) setCourseRead(result); });
    return () => { live = false; };
  }, [role]);

  const courses = availableMentorCourses(role, courseRead);
  const course = courses.find(({ id }) => id === selected);
  if (!courses.length) return null;
  const close = () => setSelected(undefined);
  return <>
    <Button tone="quiet" onClick={() => setSelected(courses[0]?.id)}>{t.title}</Button>
    {course && <Dialog open title={t.title} onClose={close} actions={<Button tone="quiet" onClick={close}>{t.close}</Button>}>
      {courses.length > 1 ? <Select label={t.course} options={courses.map(({ id, name, academicYear }) => ({
        value: id, label: `${name} · ${academicYear}`,
      }))} value={course.id} onChange={(event) => setSelected(event.currentTarget.value)} />
        : <p>{course.name}</p>}
      <CourseRoster key={course.id} course={course} />
    </Dialog>}
  </>;
}
