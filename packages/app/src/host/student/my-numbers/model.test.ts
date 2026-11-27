import { describe, expect, it } from "vitest";

import { daysToDeadline, distinctDays, numbersOf, type MyWork } from "./model";

const WORK: MyWork = { workId: "w1", title: "Izmišljeni zadatak", courseName: "Izmišljeni kolegij", dueAt: "2026-12-10T10:00:00.000Z", state: "in_progress" };

describe("distinctDays", () => {
  it("counts calendar days, not versions, and drops the time of day", () => {
    expect(distinctDays(["2026-11-01T09:00:00.000Z", "2026-11-01T17:30:00.000Z", "2026-11-03T08:00:00.000Z"])).toBe(2);
  });
  it("uses the Zagreb calendar: in November 23:00Z is already the next day there", () => {
    expect(distinctDays(["2026-11-01T21:30:00.000Z", "2026-11-01T22:30:00.000Z"])).toBe(1);
    expect(distinctDays(["2026-11-01T22:30:00.000Z", "2026-11-01T23:30:00.000Z"])).toBe(2);
  });
  it("skips a malformed time instead of counting it", () => {
    expect(distinctDays(["not a date", "2026-11-01T09:00:00.000Z"])).toBe(1);
    expect(distinctDays([])).toBe(0);
  });
});

describe("daysToDeadline", () => {
  const now = new Date("2026-12-07T12:00:00.000Z");
  it("is whole Zagreb calendar days, 0 today, negative once passed", () => {
    expect(daysToDeadline("2026-12-10T10:00:00.000Z", now, "in_progress")).toBe(3);
    expect(daysToDeadline("2026-12-07T20:00:00.000Z", now, "in_progress")).toBe(0);
    expect(daysToDeadline("2026-12-05T10:00:00.000Z", now, "in_progress")).toBe(-2);
  });
  it("is null for a submitted work and for a bad date", () => {
    expect(daysToDeadline("2026-12-10T10:00:00.000Z", now, "submitted")).toBeNull();
    expect(daysToDeadline("nonsense", now, "in_progress")).toBeNull();
  });
});

describe("numbersOf", () => {
  it("a failed versions read is null, never zero", () => {
    const n = numbersOf(WORK, null, null, new Date("2026-12-07T12:00:00.000Z"));
    expect(n.versions).toBeNull();
    expect(n.days).toBeNull();
  });
  it("marks a partial page as more", () => {
    const n = numbersOf(WORK, { savedMinutes: ["2026-11-01T09:00:00.000Z"], more: true }, { done: 1, total: 3 }, new Date("2026-12-07T12:00:00.000Z"));
    expect(n.versions).toEqual({ count: 1, more: true });
    expect(n.milestones).toEqual({ done: 1, total: 3 });
  });
});
