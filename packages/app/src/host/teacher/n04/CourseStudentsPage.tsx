"use client";

import CourseStudents from "./CourseStudents";
import { courseAssistantPort } from "../course-assistant/port";
import { courseStudentsPort } from "./port";

/** The route's N-04 (PIL-K-N04): the roster over the real port; createApi is made per read, in the browser. */
const port = courseStudentsPort();
const assistant = courseAssistantPort();

export default function CourseStudentsPage({ courseId }: { courseId: string }) {
  return <CourseStudents courseId={courseId} port={port} assistant={assistant} />;
}
