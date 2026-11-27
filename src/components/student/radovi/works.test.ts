import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../lib/i18n/messages.hr";
import type { MyCourse } from "../my-assignments-read";

import MyWorks, { type MyWorksProps } from "./MyWorks";
import { readMyWorks, type WorksRead } from "./works-read";
import { filterWorks, paramOf, rowState, worksOf, yearsOf } from "./works-view";

const t = messagesHr.student.works;

// Invented courses and assignments only.
const A1 = "10000000-0000-4000-8000-000000000001";
const A2 = "10000000-0000-4000-8000-000000000002";
const A3 = "10000000-0000-4000-8000-000000000003";
const COURSES: MyCourse[] = [
  {
    id: "00000000-0000-4000-8000-00000000000a", name: "Izmišljeni seminar iz ekologije grada", academicYear: "2026/2027",
    assignments: [
      { id: A1, title: "Čitanje naglas", dueAt: "2026-11-30T22:59:00.000Z", noticeFirst: true },
      { id: A2, title: "Kućno kompostiranje", dueAt: "2026-12-15T22:59:00.000Z", noticeFirst: false, extendedDueAt: "2026-12-22T22:59:00.000Z" },
    ],
  },
  { id: "00000000-0000-4000-8000-00000000000b", name: "Izmišljeni kolegij B", academicYear: "2025/2026",
    assignments: [{ id: A3, title: "Esej o gradu", dueAt: "2026-06-01T21:59:00.000Z", noticeFirst: false }] },
  { id: "00000000-0000-4000-8000-00000000000c", name: "Kolegij bez zadatka", assignments: [] },
];
const STATES = new Map([[A1, "not_started"], [A2, "in_progress"], [A3, "submitted"]] as const);
const ITEMS = worksOf(COURSES, STATES);

describe("works view (WEB-10)", () => {
  it("makes one row per assignment of every course, in the read's order", () => {
    expect(ITEMS.map((i) => [i.title, i.courseName, i.academicYear])).toEqual([
      ["Čitanje naglas", "Izmišljeni seminar iz ekologije grada", "2026/2027"],
      ["Kućno kompostiranje", "Izmišljeni seminar iz ekologije grada", "2026/2027"],
      ["Esej o gradu", "Izmišljeni kolegij B", "2025/2026"],
    ]);
    expect(ITEMS[1]?.extendedDueAt).toBe("2026-12-22T22:59:00.000Z");
    expect(worksOf([])).toEqual([]);
  });

  it("only narrows the rows: words of the title or course, without diacritics, and the year", () => {
    expect(filterWorks(ITEMS, { q: "", year: "" })).toEqual(ITEMS);
    expect(filterWorks(ITEMS, { q: "citanje", year: "" }).map((i) => i.assignmentId)).toEqual([A1]);
    expect(filterWorks(ITEMS, { q: "kolegij b", year: "" }).map((i) => i.assignmentId)).toEqual([A3]);
    expect(filterWorks(ITEMS, { q: "", year: "2026/2027" }).map((i) => i.assignmentId)).toEqual([A1, A2]);
    expect(filterWorks(ITEMS, { q: "esej", year: "2026/2027" })).toEqual([]);
  });

  it("lists only the years the read returned, newest first, and skips a course without one", () => {
    const withoutYear = worksOf([{ id: "00000000-0000-4000-8000-00000000000d", name: "Bez godine", assignments: [
      { id: "10000000-0000-4000-8000-000000000004", title: "Zadatak", dueAt: "2026-06-01T21:59:00.000Z", noticeFirst: false },
    ] }]);
    expect(yearsOf([...ITEMS, ...withoutYear])).toEqual(["2026/2027", "2025/2026"]);
    expect(filterWorks(withoutYear, { q: "", year: "2026/2027" })).toEqual([]);
  });

  it("puts an unconfirmed notice before the work's state, and proves nothing without the states read", () => {
    expect(ITEMS.map(rowState)).toEqual(["notice", "in_progress", "submitted"]);
    expect(worksOf(COURSES, null).map(rowState)).toEqual(["notice", null, null]);
  });

  it("reads one plain value from the query", () => {
    expect(paramOf(undefined)).toBe("");
    expect(paramOf("  esej ")).toBe("esej");
    expect(paramOf(["a", "b"])).toBe("a");
    expect(paramOf("x".repeat(300))).toHaveLength(200);
  });
});

type Answer = { ok: true; status: 200; body: unknown } | { ok: false; status: number; code: string };
function fakeCall(answers: Record<string, Answer | Error>) {
  const asked: string[] = [];
  const call = async (id: string) => {
    asked.push(id);
    const answer = answers[id];
    if (answer instanceof Error || answer === undefined) throw answer ?? new Error("not asked for");
    return answer;
  };
  return { asked, call: call as unknown as Parameters<typeof readMyWorks>[0] };
}

describe("readMyWorks (WEB-10)", () => {
  const assignments: Answer = { ok: true, status: 200, body: { courses: COURSES } };

  it("reads the courses, then the states", async () => {
    const { asked, call } = fakeCall({
      "student.assignments.get": assignments,
      "student.assignment-work.get": { ok: true, status: 200, body: { assignments: [{ assignmentId: A2, workState: "submitted" }] } },
    });
    const read = await readMyWorks(call);
    expect(asked).toEqual(["student.assignments.get", "student.assignment-work.get"]);
    expect(read.kind).toBe("ready");
    expect(read.states?.get(A2)).toBe("submitted");
  });

  it("keeps the rows without a state when the states read fails or throws", async () => {
    for (const failed of [{ ok: false, status: 404, code: "not_found" } as Answer, new Error("network")]) {
      const read = await readMyWorks(fakeCall({ "student.assignments.get": assignments, "student.assignment-work.get": failed }).call);
      expect(read).toMatchObject({ kind: "ready", states: null });
    }
  });

  it("is signed out or unavailable from the courses read alone, never an empty list", async () => {
    const signedOut = fakeCall({ "student.assignments.get": { ok: false, status: 401, code: "unauthenticated" } });
    expect(await readMyWorks(signedOut.call)).toEqual({ kind: "signedOut" });
    expect(signedOut.asked).toEqual(["student.assignments.get"]);
    expect(await readMyWorks(fakeCall({ "student.assignments.get": { ok: false, status: 503, code: "unavailable" } }).call))
      .toEqual({ kind: "unavailable" });
    // Design alignment 27. 11. 2026. (S-04): 403 is no access, not a read error.
    expect(await readMyWorks(fakeCall({ "student.assignments.get": { ok: false, status: 403, code: "forbidden" } }).call))
      .toEqual({ kind: "denied" });
  });
});

const HERE = "/zadaci/radovi";
function render(read: WorksRead, filter = { q: "", year: "" }): string {
  const props: MyWorksProps = {
    read, filter, here: HERE,
    signIn: (returnTo) => `/prijava?returnTo=${encodeURIComponent(returnTo)}`,
    workHref: (id) => `/rad/${id}`,
  };
  return renderToStaticMarkup(createElement(MyWorks, props));
}

describe("MyWorks (WEB-10)", () => {
  const ready: WorksRead = { kind: "ready", courses: COURSES, states: STATES };

  it("shows each row with its course, year, state, deadline and link to /rad/<id>", () => {
    const html = render(ready);
    // Design alignment 27. 11. 2026. (S-04): course and year as two parts 12 px apart, no dot.
    expect(html).toContain("<span>Izmišljeni seminar iz ekologije grada</span><span>2026./2027.</span>");
    expect(html).not.toContain("·");
    expect(html).toContain(t.state.notice);
    expect(html).toContain(t.state.inProgress);
    expect(html).toContain(t.state.submittedNoTime);
    expect(html).toContain("Produljeni rok:");
    expect(html).toContain(`href="/rad/${A2}"`);
    expect(html).toContain('method="get"');
    expect(html).toContain('name="godina"');
    expect(html).toContain('<option value="2025/2026">2025./2026.</option>');
  });

  it("narrows by the query and offers a reset; a filter matching nothing says so", () => {
    const html = render(ready, { q: "esej", year: "" });
    expect(html).toContain("Esej o gradu");
    expect(html).not.toContain("Kućno kompostiranje");
    expect(html).toContain(t.reset);
    expect(render(ready, { q: "nema-takvog", year: "" })).toContain(t.noMatch);
  });

  it("shows no state line without the states read", () => {
    const html = render({ kind: "ready", courses: COURSES, states: null });
    expect(html).not.toContain(t.state.inProgress);
    expect(html).not.toContain(t.state.notStarted);
  });

  it("has its own empty, signed-out and unavailable states", () => {
    expect(render({ kind: "ready", courses: [], states: null })).toContain(t.emptyHeading);
    expect(render({ kind: "signedOut" })).toContain(`/prijava?returnTo=${encodeURIComponent(HERE)}`);
    expect(render({ kind: "unavailable" })).toContain('role="alert"');
    expect(render({ kind: "unavailable" })).toContain(`href="${HERE}"`);
    expect(render({ kind: "denied" })).toContain("Nemate pristup ovom prikazu");
  });
});
