// In-memory stand-in for the course roster route (WEB-2143); invented people and times only.
import type { CourseStudentsPort, RosterData, RosterRead } from "./model";

export const FAKE_ROSTER: RosterData = {
  courseName: "Kolegij A",
  students: [
    {
      studentId: "s-1", name: "Student A", group: "Grupa 2",
      works: [
        { assignmentId: "a-1", title: "Lokalni mediji i izborna kampanja", workType: "seminar_paper", status: "submitted",
          submittedAt: "2026-11-05T20:14:00Z", afterDeadline: false, version: 2, record: "with_gaps", documentId: "doc-a",
          revision: { state: "open", deadline: "2026-11-12T22:59:00Z" } },
        { assignmentId: "a-2", title: "Esej", workType: "essay", status: "submitted",
          submittedAt: "2026-11-06T10:00:00Z", afterDeadline: false, version: 1, record: "continuous" },
      ],
    },
    {
      studentId: "s-2", name: "Student B", group: "Grupa 4",
      works: [
        { assignmentId: "a-1", title: "Seminarski rad", workType: "seminar_paper", status: "writing", documentId: "doc-b" },
        { assignmentId: "a-2", title: "Esej", workType: "essay", status: "not_submitted" },
      ],
    },
  ],
};

export function fakeCourseStudentsPort(answer: RosterRead = { kind: "ready", data: FAKE_ROSTER }): CourseStudentsPort {
  return { read: async () => answer };
}
