// WEB-2113: the tests of src/components/student/radovi/works.test.ts for the host's
// own copies (works view and readMyWorks); the MyWorks component stays there.
import { describe, expect, it } from "vitest";

import type { MyCourse } from "./assignments";
import { readMyWorks } from "./works";
import { filterWorks, worksOf, yearsOf } from "./works-view";

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
  });
});
