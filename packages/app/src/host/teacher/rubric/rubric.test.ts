import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { saveRubric, type Call } from "./port";
import {
  addCriterion, checkRubric, MAX_CRITERIA, removeCriterion, setLevel, setTitle, toCriteria, type Rubric,
} from "./rubric-model";

// Invented rubric.
const filled = (n: number): Rubric => {
  let r: Rubric = [];
  for (let i = 0; i < n; i += 1) {
    r = addCriterion(r);
    r = setTitle(r, i, `Kriterij ${i + 1}`);
    for (let j = 0; j < 3; j += 1) r = setLevel(r, i, j, { label: `Razina ${j + 1}`, descriptor: "" });
  }
  return r;
};
const callOf = (answer: (input: { body?: unknown }) => unknown) =>
  vi.fn(async (_id: string, input: { body?: unknown }) => answer(input)) as unknown as Call & ReturnType<typeof vi.fn>;

describe("rubric model", () => {
  it("adds up to 12 criteria with unique ids and never a 13th", () => {
    let r: Rubric = [];
    for (let i = 0; i < 15; i += 1) r = addCriterion(r);
    expect(r).toHaveLength(MAX_CRITERIA);
    expect(new Set(r.map((c) => c.id)).size).toBe(MAX_CRITERIA);
    expect(r.every((c) => c.levels.length === 3)).toBe(true);
  });
  it("keeps ids unique after a removal", () => {
    const r = removeCriterion(filled(3), 0);
    expect(new Set(addCriterion(r).map((c) => c.id)).size).toBe(3);
  });
  it("is valid when empty (no rubric) and flags blank titles and labels", () => {
    expect(checkRubric([])).toEqual({ fields: {} });
    const blank = addCriterion([]);
    expect(Object.keys(checkRubric(blank).fields).sort()).toEqual(["0.label0", "0.label1", "0.label2", "0.title"]);
  });
  it("flags too long text but allows an empty descriptor", () => {
    const r = setLevel(setTitle(filled(1), 0, "x".repeat(121)), 0, 1, { descriptor: "y".repeat(401) });
    expect(checkRubric(r).fields).toEqual({ "0.title": "too-long", "0.descriptor1": "too-long" });
    expect(checkRubric(filled(1)).fields).toEqual({});
  });
  it("builds no body for an empty or invalid rubric, and trims text", () => {
    expect(toCriteria([])).toBeNull();
    expect(toCriteria(addCriterion([]))).toBeNull();
    expect(toCriteria(setTitle(filled(1), 0, "  Struktura  "))![0]!.title).toBe("Struktura");
  });
});

describe("saveRubric (teacher.assignment-rubric.put)", () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, body });
  it("sends expectedVersion 0 and counts as saved only when the answer repeats the criteria", async () => {
    const r = filled(2);
    const call = callOf(({ body }) => ok({ version: 1, criteria: (body as { criteria: unknown[] }).criteria }));
    expect(await saveRubric(call, "a1", r)).toBe("saved");
    expect(call.mock.calls[0]![0]).toBe("teacher.assignment-rubric.put");
    expect((call.mock.calls[0]![1] as { body: { expectedVersion: number } }).body.expectedVersion).toBe(0);
    expect(await saveRubric(callOf(() => ok({ version: 1, criteria: [] })), "a1", r)).toBe("failed");
  });
  it("sends nothing without a valid rubric", async () => {
    const call = callOf(() => ok({}));
    expect(await saveRubric(call, "a1", [])).toBe("none");
    expect(await saveRubric(call, "a1", addCriterion([]))).toBe("none");
    expect(call).not.toHaveBeenCalled();
  });
  it("tells conflict, signed out and failure apart, and a thrown call is a failure", async () => {
    const r = filled(1);
    expect(await saveRubric(callOf(() => ({ ok: false, status: 409 })), "a1", r)).toBe("conflict");
    expect(await saveRubric(callOf(() => ({ ok: false, status: 401 })), "a1", r)).toBe("signedOut");
    expect(await saveRubric(callOf(() => ({ ok: false, status: 404 })), "a1", r)).toBe("failed");
    expect(await saveRubric(callOf(() => { throw new Error("x"); }), "a1", r)).toBe("failed");
  });
});

describe("rubric field reaches the server only through the shared client", () => {
  it("has no fetch or raw /api path", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(join(import.meta.dirname, f), "utf8"), f).not.toMatch(/\b(?:fetch|XMLHttpRequest|axios)\b|["'`]\/?api\/|<form\b/);
  });
});
