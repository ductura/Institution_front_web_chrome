import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { availableMentorCourses } from "../../../teacher/mentored-students/MentoredStudents";
import type { TeacherCourse } from "../../../teacher/teacher-courses-read";
import { MentorWorkState } from "./MentorWorkState";

describe("WEB-1111 Mentor panel", () => {
  it("renders the confirmed submission section expanded in the read-only workspace", () => {
    const markup = renderToStaticMarkup(<MentorWorkState role="student" submitted documentId="demo-rad" />);
    expect(markup).toContain("Rad je predan");
    expect(markup).toMatch(/<details[^>]* open=""/);
    expect(markup).toContain("Vremenska crta");
    expect(markup).not.toContain("Moji studenti");
  });

  it("shows an ongoing work and leaves the post-submission section closed", () => {
    const markup = renderToStaticMarkup(<MentorWorkState role="student" submitted={false} documentId="demo-rad" />);
    expect(markup).toContain("Rad je u tijeku");
    expect(markup).not.toContain("Rad je predan");
    expect(markup).not.toMatch(/<details[^>]* open=""/);
  });

  it("only offers roster choices for a teacher with a successfully read course", () => {
    const course: TeacherCourse = {
      id: "demo-kolegij", name: "Izmišljeni seminar", academicYear: "2026./2027.", aiPolicy: "prohibited", assignments: [],
    };
    expect(availableMentorCourses("teacher", { kind: "ready", courses: [course] })).toEqual([course]);
    expect(availableMentorCourses("student", { kind: "ready", courses: [course] })).toEqual([]);
    expect(availableMentorCourses("teacher", { kind: "ready", courses: [] })).toEqual([]);
    expect(availableMentorCourses("teacher", { kind: "notTeacher" })).toEqual([]);
  });
});
