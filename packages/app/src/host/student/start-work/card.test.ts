// WEB-1402: the card draws the host's action under each assignment, and nothing without one.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StudentHome from "../../../../../../src/components/student/StudentHome";
import type { MyAssignmentsRead } from "../read/assignments";

const read: MyAssignmentsRead = {
  kind: "ready",
  courses: [{
    id: "10000000-0000-4000-8000-000000000001", name: "Izmišljeni seminar",
    assignments: [
      { id: "20000000-0000-4000-8000-000000000001", title: "Izmišljeni zadatak A", dueAt: "2026-12-01T22:59:00.000Z", noticeFirst: false },
      { id: "20000000-0000-4000-8000-000000000002", title: "Izmišljeni zadatak B", dueAt: "2026-12-02T22:59:00.000Z", noticeFirst: true },
    ],
  }],
} as MyAssignmentsRead;
const signIn = (returnTo: string) => `/prijava?returnTo=${returnTo}`;

describe("assignmentAction on the card", () => {
  it("is drawn once per assignment, after its link, with that assignment", () => {
    const html = renderToStaticMarkup(createElement(StudentHome, {
      read, enroll: null, signIn,
      assignmentAction: (a) => (a.noticeFirst ? null : createElement("button", { type: "button" }, `akcija ${a.title}`)),
    }));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<\/a><button type="button">akcija Izmišljeni zadatak A<\/button><\/li>/);
    expect(html).not.toContain("akcija Izmišljeni zadatak B");
  });

  it("without one the card is as before", () => {
    const html = renderToStaticMarkup(createElement(StudentHome, { read, enroll: null, signIn }));
    expect(html).not.toContain("<button");
    expect(html.match(/<li><a /g)).toHaveLength(2);
  });
});
