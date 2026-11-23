// In-memory stand-in for the course-aggregate route (WEB-1706); invented numbers only.
import type { AggregateData, AggregateRead, CourseAggregatePort, CourseAssignment } from "./model";

export const FAKE_AGGREGATE: AggregateData = {
  students: 24,
  counts: { submitted: 18, inProgress: 6, notStarted: 0 },
};

/** Two invented regular assignments and one invented practice assignment of a course. */
export const FAKE_ASSIGNMENTS: readonly CourseAssignment[] = [
  { assignmentId: "00000000-0000-4000-8000-0000000000d1", isPractice: false },
  { assignmentId: "00000000-0000-4000-8000-0000000000d2", isPractice: true },
  { assignmentId: "00000000-0000-4000-8000-0000000000d3" },
];

/** The fake port; `asked` keeps the assignment ids of every read, to show what the aggregate covered. */
export function fakeCourseAggregatePort(answer: AggregateRead = { kind: "ready", data: FAKE_AGGREGATE }): CourseAggregatePort & { readonly asked: (readonly string[])[] } {
  const asked: (readonly string[])[] = [];
  return { asked, read: async (_courseId, assignmentIds) => { asked.push([...assignmentIds]); return answer; } };
}
