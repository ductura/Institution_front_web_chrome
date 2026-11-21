// In-memory stand-in for the course-aggregate route (WEB-1706); invented numbers only.
import type { AggregateData, AggregateRead, CourseAggregatePort } from "./model";

export const FAKE_AGGREGATE: AggregateData = {
  students: 24,
  counts: { submitted: 18, afterDeadline: 6, continuous: 15, withGaps: 8 },
};

export function fakeCourseAggregatePort(answer: AggregateRead = { kind: "ready", data: FAKE_AGGREGATE }): CourseAggregatePort {
  return { read: async () => answer };
}
