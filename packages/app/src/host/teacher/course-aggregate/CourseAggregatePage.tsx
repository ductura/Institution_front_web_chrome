"use client";

import { useEffect, useMemo, useState } from "react";

import { useHost } from "../../context";
import { TeacherPage, type TeacherRead } from "../shell/TeacherPage";
import CourseAggregate from "./CourseAggregate";
import { courseAggregateMessages as text } from "./messages.hr";
import type { ReadAssignment } from "../assignment-card/model";
import { courseAggregatePort, readCourseAssignments, signInToAggregate, type AggregateCall, type CourseAssignmentsRead } from "./port";

type Course = Extract<CourseAssignmentsRead, { kind: "ready" }>["value"];

/**
 * "Zbirni pregled kolegija" (PIL-K-ZBIRNO, N-17): the course's assignments and their practice flag first,
 * then the aggregate over the ones that are not practice. A signed-out read goes to sign-in and back here.
 */
export default function CourseAggregatePage({ courseId, client, readAssignment, leave }: {
  courseId: string;
  /** The tests' stand-in for createApi; without it the ports make createApi per read, in the browser. */
  client?: () => AggregateCall; readAssignment?: ReadAssignment; leave?: (href: string) => void;
}) {
  const { base } = useHost();
  const port = useMemo(() => courseAggregatePort(client), [client]);
  const [read, setRead] = useState<TeacherRead<Course> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourseAssignments(courseId, client, readAssignment).catch((): CourseAssignmentsRead => ({ kind: "unavailable" })).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") signInToAggregate(base, courseId, leave);
      setRead(next);
    });
    return () => { live = false; };
  }, [courseId, base, attempt, client, readAssignment, leave]);

  const title = read?.kind === "ready" ? text.courseTitle(read.value.courseName) : text.title;
  return (
    <TeacherPage title={title} lead={text.lead} loading={text.loading} read={read} retry={() => setAttempt((n) => n + 1)}
      unavailable={text.unavailable} retryLabel={text.retry}
      ready={(course) => (
        <CourseAggregate courseId={courseId} assignments={course.assignments} port={port} onSignedOut={() => signInToAggregate(base, courseId, leave)} />
      )} />
  );
}
