import { describe, expect, it } from "vitest";

import type { MyCourse } from "../../../../../../src/components/student/my-assignments-read";
import { continueRow, enrollRoute, flatRows, kindOf, nearTag, normalizeCode, rowAction, rowRoute } from "./model";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const A = { id: "a1", title: "Esej o izmišljenoj temi", dueAt: "2026-11-23T10:00:00Z", noticeFirst: false };
const COURSES: MyCourse[] = [
  { id: "c1", name: "Kolegij A", assignments: [
    { ...A, workType: "essay" },
    { id: "a2", title: "Drugi", dueAt: "2026-12-30T10:00:00Z", noticeFirst: true },
    { id: "a3", title: "Treći", dueAt: "2026-12-30T10:00:00Z", noticeFirst: false, extendedDueAt: "2027-01-10T10:00:00Z" },
  ] },
  { id: "c2", name: "Kolegij B", assignments: [{ id: "a4", title: "Četvrti", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false }] },
];

describe("E-2 rows", () => {
  it("checks submitted, then notice, then started, else task", () => {
    const states = new Map([["a1", "submitted" as const], ["a2", "in_progress" as const], ["a3", "in_progress" as const]]);
    expect(kindOf(COURSES[0]!.assignments[0]!, states)).toBe("predano");
    expect(kindOf(COURSES[0]!.assignments[1]!, states)).toBe("obavijest");
    expect(kindOf(COURSES[0]!.assignments[2]!, states)).toBe("rad");
    expect(kindOf(COURSES[1]!.assignments[0]!, states)).toBe("zadatak");
    expect(kindOf(COURSES[1]!.assignments[0]!, null)).toBe("zadatak");
  });
  it("lists every assignment flat with its course, the extended deadline replacing the original", () => {
    const rows = flatRows(COURSES, new Map());
    expect(rows.map((r) => [r.id, r.course])).toEqual([["a1", "Kolegij A"], ["a2", "Kolegij A"], ["a3", "Kolegij A"], ["a4", "Kolegij B"]]);
    expect(rows[2]!).toMatchObject({ dueAt: "2027-01-10T10:00:00Z", extended: true });
    expect(rows[0]!.typeLabel).toBe("Esej");
    expect(rows[3]!.typeLabel).toBe("Zadatak");
  });
  it("continues the first started work with an acknowledged notice only", () => {
    const rows = flatRows(COURSES, new Map([["a2", "in_progress" as const], ["a4", "in_progress" as const]]));
    expect(continueRow(rows)?.id).toBe("a4");
    expect(continueRow(flatRows(COURSES, new Map()))).toBeNull();
  });
});

describe("deadline tag", () => {
  it("names the days within a week, never past or far ahead", () => {
    expect(nearTag(A.dueAt, NOW)).toBe("Rok za 3 dana");
    expect(nearTag("2026-11-21T09:00:00Z", NOW)).toBe("Rok za 1 dan");
    expect(nearTag("2026-11-20T11:00:00Z", NOW)).toBe("Rok za 1 dan");
    expect(nearTag("2026-11-20T09:00:00Z", NOW)).toBeNull();
    expect(nearTag("2026-12-30T10:00:00Z", NOW)).toBeNull();
    expect(nearTag("nije datum", NOW)).toBeNull();
  });
});

describe("routes and code", () => {
  it("opens a row as the prototype's R-9", () => {
    expect(rowRoute({ id: "a/1", kind: "predano" })).toBe("/rad/a%2F1/predaja/potvrda");
    expect(rowRoute({ id: "a1", kind: "obavijest" })).toBe("/zadatak/a1");
    expect(rowRoute({ id: "a1", kind: "rad" })).toBe("/rad/a1");
    expect(rowRoute({ id: "a1", kind: "zadatak" })).toBe("/rad/a1");
  });
  it("labels the buttons as btn()", () => {
    expect(rowAction("predano")).toEqual({ label: "Otvori rad", primary: false });
    expect(rowAction("obavijest")).toEqual({ label: "Pročitaj upute", primary: false });
    expect(rowAction("rad")).toEqual({ label: "Otvori rad", primary: true });
    expect(rowAction("zadatak")).toEqual({ label: "Otvori zadatak", primary: true });
  });
  it("carries the code to E-5 trimmed and in capitals (R-10)", () => {
    expect(normalizeCode("  ab-12 ")).toBe("AB-12");
    expect(enrollRoute(" abc12345 ")).toBe("/upis?kod=ABC12345");
    expect(enrollRoute("   ")).toBe("/upis");
  });
});
