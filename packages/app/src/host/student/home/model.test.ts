import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { MyCourse } from "../read/assignments";
import { normalizeCode as enrollRule } from "../../../../../../src/components/student/upis/enroll";
import { CODE_MAX, cleanCode } from "../enrol/code";
import { codeFromQuery } from "../enrol/model";
import { continueRow, coursesWithoutTask, deadlineTag, sections, enrollRoute, flatRows, kindOf, nearTag, normalizeCode, rowAction, rowRoute, startsWork, type TaskRow } from "./model";

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
  it("carries the practice badge only for a row the server marked isPractice: true (P-D1)", () => {
    const practice = { ...A, id: "p1", isPractice: true } as MyCourse["assignments"][number];
    const regular = { ...A, id: "r1", isPractice: false } as MyCourse["assignments"][number];
    const rows = flatRows([{ id: "c", name: "Kolegij P", assignments: [practice, regular, A] }], null);
    expect(rows.map((r) => [r.id, r.practice])).toEqual([["p1", true], ["r1", false], ["a1", false]]);
  });
  it("lists every assignment flat with its course, the extended deadline replacing the original", () => {
    const rows = flatRows(COURSES, new Map());
    expect(rows.map((r) => [r.id, r.course])).toEqual([["a1", "Kolegij A"], ["a2", "Kolegij A"], ["a3", "Kolegij A"], ["a4", "Kolegij B"]]);
    expect(rows[2]!).toMatchObject({ dueAt: "2027-01-10T10:00:00Z", extended: true });
    expect(rows[0]!.typeLabel).toBe("Esej");
    expect(rows[3]!.typeLabel).toBe("Zadatak");
  });
  it("continues the started work with an acknowledged notice only", () => {
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
    expect(normalizeCode("  ab-12 ")).toBe("AB12");
    expect(enrollRoute(" abc12345 ")).toBe("/upis?kod=ABC12345");
    expect(enrollRoute("   ")).toBe("/upis");
  });
});

describe("P-3 deadline tag (E-2a)", () => {
  const row = (over: Partial<TaskRow>): TaskRow => ({
    id: "a1", title: "T", course: "K", kind: "zadatak", dueAt: "2026-11-18T22:59:00.000Z", extended: false,
    originalDueAt: "2026-11-18T22:59:00.000Z", typeLabel: "Esej", practice: false, ...over,
  });
  it("says the deadline has passed, with its date in Zagreb, for a row not submitted", () => {
    expect(deadlineTag(row({}), NOW)).toEqual({ kind: "late", text: "Rok je prošao 18. 11. 2026." });
    expect(deadlineTag(row({ kind: "rad" }), NOW)?.kind).toBe("late");
    expect(deadlineTag(row({ kind: "obavijest" }), NOW)?.kind).toBe("late");
  });
  it("is gone once the work is submitted, and before the deadline", () => {
    expect(deadlineTag(row({ kind: "predano" }), NOW)).toBeNull();
    expect(deadlineTag(row({ dueAt: "2026-11-21T10:00:00.000Z", originalDueAt: "2026-11-21T10:00:00.000Z" }), NOW)).toBeNull();
    expect(deadlineTag(row({ dueAt: "not a date" }), NOW)).toBeNull();
  });
  it("tells an extension still running apart from a passed deadline", () => {
    const extended = row({ dueAt: "2026-11-30T22:59:00.000Z", extended: true });
    expect(deadlineTag(extended, NOW)).toEqual({ kind: "extension", text: "Izvorni rok je prošao 18. 11. 2026." });
    const passedToo = row({ dueAt: "2026-11-19T22:59:00.000Z", extended: true });
    expect(deadlineTag(passedToo, NOW)).toEqual({ kind: "late", text: "Rok je prošao 19. 11. 2026." });
  });
  it("keeps the original deadline beside the extended one", () => {
    const rows = flatRows(COURSES, null);
    expect(rows[2]!).toMatchObject({ dueAt: "2027-01-10T10:00:00Z", originalDueAt: "2026-12-30T10:00:00Z" });
  });
});

describe("P-11 one code rule (E-5b)", () => {
  const samples = ["  ab-cd-ef-12 ", "abcd 1234", "KOL-D-2026", "ab\tcd\n1234", "a-b", "", "  ", "x".repeat(40), "ab12cd34ef56gh78"];
  it("is the same function on the home card, in ?kod and in the field", () => {
    for (const raw of samples) {
      expect(normalizeCode(raw)).toBe(cleanCode(raw));
      const fromQuery = codeFromQuery(`?kod=${encodeURIComponent(raw)}`);
      expect(fromQuery ?? "").toBe(cleanCode(raw).slice(0, 64));
    }
  });
  it("leaves the code as enroll() sends it, whenever enroll() would send it", () => {
    for (const raw of samples) {
      const sent = enrollRule(raw);
      if (sent !== null) expect(cleanCode(raw)).toBe(sent);
      expect(enrollRule(cleanCode(raw))).toBe(sent);
    }
  });
  it("carries a clean code from the home card to E-5", () => {
    expect(enrollRoute("kol-d-2026")).toBe("/upis?kod=KOLD2026");
    expect(enrollRoute(" - ")).toBe("/upis");
    expect(CODE_MAX).toBe(32);
  });
});

describe("P-4 urgency and order", () => {
  const started = (ids: string[]) => new Map(ids.map((id) => [id, "in_progress" as const]));
  it("continues the started work with the nearest deadline, not the first in the list", () => {
    // a3 (extended to 2027-01-10) comes before a4 (2026-12-01) in the read; a4 is nearer.
    expect(continueRow(flatRows(COURSES, started(["a3", "a4"])))?.id).toBe("a4");
    expect(continueRow(flatRows(COURSES, started(["a1", "a3", "a4"])))?.id).toBe("a1");
  });
  it("keeps the read's order for equal deadlines and puts a broken date last", () => {
    const rows = flatRows(COURSES, started(["a1", "a4"])).map((r) => (r.id === "a1" ? { ...r, dueAt: r.id === "a1" ? "2026-12-01T10:00:00Z" : r.dueAt } : r));
    expect(continueRow(rows)?.id).toBe("a1");
    const broken = flatRows(COURSES, started(["a1", "a4"])).map((r) => (r.id === "a1" ? { ...r, dueAt: "?" } : r));
    expect(continueRow(broken)?.id).toBe("a4");
  });
  it("lists by deadline in Uskoro, Kasnije and Predano, submitted at the bottom", () => {
    const states = new Map([["a4", "submitted" as const]]);
    const groups = sections(flatRows(COURSES, states), NOW);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["uskoro", ["a1"]], ["kasnije", ["a2", "a3"]], ["predano", ["a4"]],
    ]);
  });
  it("puts a passed deadline into Uskoro, first, and leaves empty sections out", () => {
    const late = { id: "x", title: "Zakašnjeli", dueAt: "2026-11-01T10:00:00Z", noticeFirst: false };
    const groups = sections(flatRows([{ id: "c", name: "K", assignments: [A, late] }], null), NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(["x", "a1"]);
  });
  it("order kolegij is the read's own order and nothing is lost or doubled", () => {
    const rows = flatRows(COURSES, new Map([["a1", "submitted" as const]]));
    expect(sections(rows, NOW, "kolegij").flatMap((g) => g.rows.map((r) => r.id))).toEqual(["a1", "a2", "a3", "a4"]);
    expect(sections(rows, NOW).flatMap((g) => g.rows).map((r) => r.id).sort()).toEqual(["a1", "a2", "a3", "a4"]);
    expect(sections([], NOW)).toEqual([]);
  });
});

describe("P-12 courses without a task", () => {
  it("returns every course with no assignment, not only the first", () => {
    const courses: MyCourse[] = [
      { id: "c1", name: "Kolegij A", assignments: [] }, { id: "c2", name: "Kolegij B", assignments: [] },
    ];
    expect(coursesWithoutTask(courses).map((c) => c.name)).toEqual(["Kolegij A", "Kolegij B"]);
    expect(coursesWithoutTask(COURSES)).toEqual([]);
  });
});

describe("INT-31 start only where no work exists", () => {
  it("offers \"Započni rad\" on a row with no work, never on a started, submitted or notice-first one", () => {
    expect(startsWork("zadatak")).toBe(true);
    expect(startsWork("rad")).toBe(false);
    expect(startsWork("predano")).toBe(false);
    expect(startsWork("obavijest")).toBe(false);
  });

  it("a started work keeps its own \"Otvori rad\"", () => {
    const rows = flatRows(COURSES, new Map([["a1", "in_progress"]]));
    const kind = rows.find((row) => row.id === "a1")?.kind;
    expect(kind).toBe("rad");
    expect(startsWork("rad")).toBe(false);
    expect(rowAction("rad").label).toBe("Otvori rad");
  });

  it("the home page draws the start only through startsWork", () => {
    const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HomePage.tsx"), "utf8");
    expect(page).toMatch(/action=\{startsWork\(row\.kind\) \? startWorkAction\(/);
  });
});
