// DAN-876: the read form of MyAssignments, the S02 page body over
// student.assignments.get. The answers are the route's vectors (a copy that
// src/client/student-assignments.test.ts keeps equal to @ductura/test-fakes and
// runs through createApi); here each read is what readMyAssignments gives it.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../locales/hr.ts";

import vectors from "./fixtures/student.assignments.get.json" with { type: "json" };
import type { MyAssignmentsRead, MyCourse } from "./my-assignments-read";
import MyAssignments from "./MyAssignments";

const home = messagesHr.student.home;
const t = messagesHr.student.assignments;
const signIn = (returnTo: string) => `/prijava?returnTo=${encodeURIComponent(returnTo)}`;
const courses = (vectors.vectors.find((v) => v.name === "ready")?.response.body as { courses: MyCourse[] }).courses;

/** The page once the read has settled. */
async function settled(read: MyAssignmentsRead): Promise<string> {
  const { prelude } = await prerender(createElement(MyAssignments, { read: Promise.resolve(read), signIn }));
  return new Response(prelude).text();
}

describe("MyAssignments over student.assignments.get (DAN-876)", () => {
  it("unavailable shows ErrorScreen and nothing of a list", async () => {
    const html = await settled({ kind: "unavailable" });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${home.unavailableHeading}</h1>`);
    expect(html).toContain(home.unavailableBody);
    expect(html).not.toContain("/rad?zadatak=");
    for (const course of courses) expect(html).not.toContain(course.name);
  });

  it("signed out keeps the AAI@EduHr sign-in back to this page (D-09), not a list", async () => {
    const html = await settled({ kind: "signedOut" });
    expect(html).toContain(t.signedOut);
    expect(html).toContain(`href="/prijava?returnTo=%2Fzadaci%2Fkolegiji"`);
    expect(html).not.toContain("/rad?zadatak=");
  });

  it("while the read is pending, the page is RouteLoading and shows no assignment", () => {
    const html = renderToStaticMarkup(createElement(MyAssignments, { read: new Promise<MyAssignmentsRead>(() => {}), signIn }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`<p role="status">${messagesHr.workspace.panelLoading}</p>`);
    expect(html).not.toContain("/rad?zadatak=");
  });

  it("ready-empty is the empty state, not an error", async () => {
    const html = await settled({ kind: "ready", courses: [] });
    expect(html).toContain(home.courses);
    expect(html).not.toContain(home.unavailableHeading);
  });

  it("ready shows every assignment of the vector with its link and due time", async () => {
    const html = await settled({ kind: "ready", courses });
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain(`<h1`);
    for (const course of courses) {
      expect(html).toContain(course.name);
      for (const assignment of course.assignments) {
        expect(html).toContain(assignment.title);
        expect(html).toContain(`href="/rad?zadatak=${assignment.id}"`);
      }
    }
    expect(html).toContain("Rok: 1. prosinca 2026. u 23:59");
    expect(html).toContain("Rok: 15. siječnja 2027. u 23:59");
  });
});
