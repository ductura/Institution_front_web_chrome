import { describe, expect, it } from "vitest";

import {
  addDeadline, clean, daysUntil, defaultState, goalStatus, pagesOf, parseDeadlines, parseStash, parseStates, parseTextMap,
  parseThread, preview, progressRatio, readJson, stashAdd, stashRemove, withText, writeJson, MAX_STASH,
} from "./left-model";

// WEB-2126: invented chapters, texts and dates only.
describe("chapter state and goal", () => {
  it("an empty chapter is a draft, a written one is in progress", () => {
    expect(defaultState(0)).toBe("draft");
    expect(defaultState(12)).toBe("working");
  });
  it("judges the words against the limits", () => {
    expect(goalStatus(10, undefined)).toBe("none");
    expect(goalStatus(10, { min: 50, max: 100 })).toBe("below");
    expect(goalStatus(50, { min: 50, max: 100 })).toBe("met");
    expect(goalStatus(101, { min: 50, max: 100 })).toBe("above");
    expect(goalStatus(3000, { min: null, max: null })).toBe("none");
  });
  it("gives a ratio only when there is a limit", () => {
    expect(progressRatio(25, { min: 100 })).toBe(0.25);
    expect(progressRatio(250, { min: 100 })).toBe(1);
    expect(progressRatio(5, { max: 10 })).toBe(0.5);
    expect(progressRatio(5, {})).toBeNull();
    expect(progressRatio(5, { min: 0 })).toBeNull();
  });
  it("counts about 300 words to a page", () => {
    expect(pagesOf(0)).toBe(0);
    expect(pagesOf(900)).toBe(3);
  });
});

describe("days to a deadline", () => {
  const now = new Date(2026, 10, 22, 15, 30);
  it("counts calendar days, not 24 h spans", () => {
    expect(daysUntil("2026-11-22", now)).toBe(0);
    expect(daysUntil("2026-11-23", now)).toBe(1);
    expect(daysUntil("2026-12-02", now)).toBe(10);
    expect(daysUntil("2026-11-20", now)).toBe(-2);
  });
  it("refuses what is not a date", () => {
    expect(daysUntil("22.11.2026.", now)).toBeNull();
    expect(daysUntil("2026-02-31", now)).toBeNull();
    expect(daysUntil("", now)).toBeNull();
  });
  it("keeps own deadlines sorted and refuses empty names or dates", () => {
    const a = addDeadline([], "Prvi nacrt", "2026-12-10", "a")!;
    const b = addDeadline(a, "Izvori", "2026-12-01", "b")!;
    expect(b.map((d) => d.id)).toEqual(["b", "a"]);
    expect(addDeadline(b, "  ", "2026-12-01", "c")).toBeNull();
    expect(addDeadline(b, "Naziv", "sutra", "c")).toBeNull();
    expect(parseDeadlines([{ id: "x", label: "Ok", date: "2026-12-01" }, { id: 1 }, { id: "y", label: "", date: "2026-12-01" }])).toHaveLength(1);
  });
});

describe("local storage", () => {
  it("falls back on a damaged or missing record and on a throwing store", () => {
    const bad = { getItem: () => "{nope", setItem: () => undefined };
    expect(readJson(bad, "k", parseStates, {})).toEqual({});
    expect(readJson(null, "k", parseStates, {})).toEqual({});
    expect(writeJson({ getItem: () => null, setItem: () => { throw new Error("full"); } }, "k", {})).toBe(false);
    expect(writeJson(null, "k", {})).toBe(false);
  });
  it("keeps only the known chapter states", () => {
    expect(parseStates({ a: "done", b: "later", c: 3 })).toEqual({ a: "done" });
    expect(parseStates([])).toEqual({});
  });
  it("sets and removes a note by chapter", () => {
    const one = withText({}, "a", "  Zašto ovdje  ");
    expect(one).toEqual({ a: "Zašto ovdje" });
    expect(withText(one, "a", "   ")).toEqual({});
    expect(parseTextMap({ a: "x", b: "", c: 4 })).toEqual({ a: "x" });
    expect(clean("a".repeat(5000)).length).toBe(2000);
  });
  it("stashes newest first, drops blanks and caps the list", () => {
    let items = stashAdd([], "prvi odlomak", "1", "t");
    items = stashAdd(items, "   ", "2", "t");
    items = stashAdd(items, "drugi odlomak", "3", "t");
    expect(items.map((i) => i.id)).toEqual(["3", "1"]);
    expect(stashRemove(items, "3").map((i) => i.id)).toEqual(["1"]);
    let many = items;
    for (let i = 0; i < MAX_STASH + 5; i += 1) many = stashAdd(many, `t${i}`, `n${i}`, "t");
    expect(many).toHaveLength(MAX_STASH);
    expect(parseStash([{ id: "a", text: "x", at: "t" }, { id: 1 }, { id: "b", text: "", at: "t" }])).toHaveLength(1);
    expect(preview("riječ ".repeat(30), 20).length).toBe(20);
  });
  it("reads the thread of the work defensively", () => {
    expect(parseThread({ question: " Što? ", hypotheses: ["h1", 2, "h3"] })).toEqual({ question: "Što?", hypotheses: ["h1", "h3"] });
    expect(parseThread(null)).toEqual({ question: "", hypotheses: [] });
  });
});
