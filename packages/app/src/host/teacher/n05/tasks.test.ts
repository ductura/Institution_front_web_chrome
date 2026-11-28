// WEB-NUZ-NZ NZ-1: the chooser "Zadatak" of Brz put. Invented courses only.
import { describe, expect, it } from "vitest";

import { fastPathPath, fastPathTasks } from "./model";

const NOW = Date.parse("2026-11-24T10:00:00.000Z");

describe("Brz put chooser (NZ-1)", () => {
  it("lists every assignment of every course, a passed deadline too", () => {
    const courses = [
      { name: "Kolegij A", assignments: [{ id: "a1", title: "Esej", dueAt: "2026-11-08T22:59:00.000Z" }] },
      { name: "Kolegij B", assignments: [{ id: "a2", title: "Seminar", dueAt: "2026-12-15T22:59:00.000Z" }] },
    ] as unknown as Parameters<typeof fastPathTasks>[0];
    expect(fastPathTasks(courses, NOW)).toEqual([
      { value: "a1", label: "Kolegij A, Esej, rok je prošao" },
      { value: "a2", label: "Kolegij B, Seminar, rok 15. 12. 2026. u 23:59" },
    ]);
    expect(fastPathTasks([], NOW)).toEqual([]);
  });
  it("opens the works of one assignment", () => {
    expect(fastPathPath("a 1")).toBe("/nastavnik/brz-put?zadatak=a%201");
  });
});
