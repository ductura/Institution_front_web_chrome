import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readRubricMarks, saveMark, type Call } from "./port";
import { rubricMarksHr } from "./messages.hr";
import { isChanged, joinRows, noteValue, NOTE_MAX, withMark, type Mark } from "./rubric-marks-model";

// Invented work, assignment and rubric.
const LEVELS = [0, 1, 2].map((i) => ({ label: `Razina ${i + 1}`, descriptor: "" }));
const RUBRIC = { version: 2, criteria: [{ id: "k1", title: "Struktura", levels: LEVELS }, { id: "k2", title: "Izvori", levels: LEVELS }] };
const MARKS = { rubricVersion: 2, marks: [{ criterionId: "k1", level: 1, note: null }, { criterionId: "k2", level: null, note: "Bilješka" }] };
const ok = (body: unknown) => ({ ok: true, status: 200, body });
const no = (status: number) => ({ ok: false, status });
const routes = (over: Record<string, (input: { params?: unknown; body?: unknown }) => unknown> = {}) => {
  const table: Record<string, (input: { params?: unknown; body?: unknown }) => unknown> = {
    "teacher.work.get": () => ok({ documentId: "d1", assignmentId: "a1", studentId: "s1", studentName: null, state: "open" }),
    "teacher.assignment-rubric.get": () => ok(RUBRIC),
    "teacher.work-rubric.get": () => ok(MARKS),
    ...over,
  };
  return vi.fn(async (id: string, input: { params?: unknown; body?: unknown }) => {
    const route = table[id];
    if (!route) throw new Error(`no route ${id}`);
    return route(input);
  }) as unknown as Call & ReturnType<typeof vi.fn>;
};

describe("marks model", () => {
  const marks: Mark[] = [{ criterionId: "k1", level: 0, note: null }, { criterionId: "x9", level: 2, note: null }];
  it("joins marks to criteria in the server's order and keeps an unknown criterion visible as null", () => {
    const rows = joinRows([{ id: "k1", title: "Struktura", levels: [LEVELS[0]!, LEVELS[1]!, LEVELS[2]!] }], marks);
    expect(rows.map((r) => [r.mark.criterionId, r.criterion?.title ?? null])).toEqual([["k1", "Struktura"], ["x9", null]]);
  });
  it("replaces only the answered mark", () => {
    expect(withMark(marks, { criterionId: "k1", level: 2, note: "n" }).map((m) => m.level)).toEqual([2, 2]);
  });
  it("trims the note, sends null when empty and refuses one over the limit", () => {
    expect(noteValue("  dobro  ")).toEqual({ ok: true, note: "dobro" });
    expect(noteValue("   ")).toEqual({ ok: true, note: null });
    expect(noteValue("x".repeat(NOTE_MAX))).toEqual({ ok: true, note: "x".repeat(NOTE_MAX) });
    expect(noteValue("x".repeat(NOTE_MAX + 1))).toEqual({ ok: false });
    // The old sentinel text is an ordinary note.
    expect(noteValue(" too-long ")).toEqual({ ok: true, note: "too-long" });
  });
  it("sees a change in level or note and ignores whitespace-only edits", () => {
    const saved: Mark = { criterionId: "k1", level: 1, note: "a" };
    expect(isChanged(saved, 1, "a ")).toBe(false);
    expect(isChanged(saved, 2, "a")).toBe(true);
    expect(isChanged(saved, 1, "")).toBe(true);
  });
  it("names no number, sum, grade or ranking", () => {
    expect(JSON.stringify(rubricMarksHr)).not.toMatch(/ocjen|zbroj(?!\.)|bod(ov|a)?\b.*ukupn|rang|poredak/i);
  });
});

describe("readRubricMarks", () => {
  it("reads the assignment of the work, then its rubric and marks", async () => {
    const call = routes();
    const read = await readRubricMarks(call, "d1");
    expect(read).toMatchObject({ kind: "ready", rubricVersion: 2, currentVersion: 2 });
    if (read.kind !== "ready") throw new Error("expected ready");
    expect(read.rubric.map((c) => c.title)).toEqual(["Struktura", "Izvori"]);
    expect(read.marks.map((m) => m.level)).toEqual([1, null]);
    const rubricCall = call.mock.calls.find((c) => c[0] === "teacher.assignment-rubric.get")!;
    expect((rubricCall[1] as { params: unknown }).params).toEqual({ assignmentId: "a1" });
  });
  it("is none when the assignment has no rubric, so the private criteria stay", async () => {
    expect(await readRubricMarks(routes({ "teacher.assignment-rubric.get": () => ok({ version: 0, criteria: [] }) }), "d1")).toEqual({ kind: "none" });
    expect(await readRubricMarks(routes({ "teacher.work-rubric.get": () => ok({ rubricVersion: 0, marks: MARKS.marks }) }), "d1")).toEqual({ kind: "none" });
  });
  it("treats a foreign or unknown work (404) as not found, never as empty", async () => {
    expect(await readRubricMarks(routes({ "teacher.work.get": () => no(404) }), "d1")).toEqual({ kind: "notFound" });
    expect(await readRubricMarks(routes({ "teacher.work-rubric.get": () => no(404) }), "d1")).toEqual({ kind: "notFound" });
  });
  it("tells signed out and failure apart and does not show an error as no data", async () => {
    expect(await readRubricMarks(routes({ "teacher.work.get": () => no(401) }), "d1")).toEqual({ kind: "signedOut" });
    expect(await readRubricMarks(routes({ "teacher.assignment-rubric.get": () => no(500) }), "d1")).toEqual({ kind: "unavailable" });
    expect(await readRubricMarks(routes({ "teacher.work.get": () => { throw new Error("x"); } }), "d1")).toEqual({ kind: "unavailable" });
  });
  it("refuses an answer for another work and a criterion without three levels", async () => {
    expect(await readRubricMarks(routes({ "teacher.work.get": () => ok({ documentId: "other", assignmentId: "a1" }) }), "d1")).toEqual({ kind: "unavailable" });
    const bad = { version: 1, criteria: [{ id: "k1", title: "T", levels: LEVELS.slice(0, 2) }] };
    expect(await readRubricMarks(routes({ "teacher.assignment-rubric.get": () => ok(bad) }), "d1")).toEqual({ kind: "unavailable" });
  });
});

describe("saveMark (teacher.work-rubric-mark.put)", () => {
  it("sends level and note for the criterion and returns what the server holds", async () => {
    const call = routes({ "teacher.work-rubric-mark.put": ({ body }) => ok({ criterionId: "k1", ...(body as object) }) });
    expect(await saveMark(call, "d1", "k1", 2, "Dobro")).toEqual({ kind: "saved", mark: { criterionId: "k1", level: 2, note: "Dobro" } });
    expect(call.mock.calls[0]![1]).toMatchObject({ params: { documentId: "d1", criterionId: "k1" }, body: { level: 2, note: "Dobro" } });
  });
  it("is not saved when the answer names another criterion", async () => {
    expect(await saveMark(routes({ "teacher.work-rubric-mark.put": () => ok({ criterionId: "k2", level: 1, note: null }) }), "d1", "k1", 1, null)).toEqual({ kind: "failed" });
  });
  it("tells signed out, gone (404) and failure apart", async () => {
    const put = (status: number) => routes({ "teacher.work-rubric-mark.put": () => no(status) });
    expect(await saveMark(put(401), "d1", "k1", 0, null)).toEqual({ kind: "signedOut" });
    expect(await saveMark(put(404), "d1", "k1", 0, null)).toEqual({ kind: "gone" });
    expect(await saveMark(put(500), "d1", "k1", 0, null)).toEqual({ kind: "failed" });
    expect(await saveMark(routes({ "teacher.work-rubric-mark.put": () => { throw new Error("x"); } }), "d1", "k1", 0, null)).toEqual({ kind: "failed" });
  });
});

describe("rubric marks reach the server only through the shared client", () => {
  it("has no fetch or raw /api path", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(readFileSync(join(import.meta.dirname, f), "utf8"), f).not.toMatch(/\b(?:fetch|XMLHttpRequest|axios)\b|["'`]\/?api\/|<form\b/);
  });
  it("is mounted in the teacher's work page", () => {
    expect(readFileSync(join(import.meta.dirname, "..", "pages.tsx"), "utf8")).toMatch(/<RubricMarks\b/);
  });
});
