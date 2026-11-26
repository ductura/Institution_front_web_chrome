import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { dailyPace } from "../assist/deadlines";
import { WorkPlanner } from "./WorkPlanner";
import { chapterGap, planWork, type PlanChapter } from "./work-plan";

// F4-PM2-R19: invented chapters only.
const chapters: PlanChapter[] = [
  { id: "a", label: "1. Uvod", words: 200, target: { min: 500, max: 800 } },
  { id: "b", label: "2. Metoda", words: 900, target: { min: 400, max: 800 } },
  { id: "c", label: "3. Bez cilja", words: 50 },
  { id: "d", label: "4. Zaključak", words: 0, target: { min: 300, max: null } },
];

describe("daily pace", () => {
  it("rounds up and is 0 without words or days", () => {
    expect(dailyPace(600, 4)).toBe(150);
    expect(dailyPace(601, 4)).toBe(151);
    expect(dailyPace(0, 4)).toBe(0);
    expect(dailyPace(100, 0)).toBe(0);
    expect(dailyPace(100, Number.NaN)).toBe(0);
  });
});

describe("chapter gap", () => {
  it("counts only what lacks to the minimum and flags the maximum", () => {
    expect(chapterGap(200, { min: 500, max: 800 })).toEqual({ remaining: 300, over: false });
    expect(chapterGap(900, { min: 400, max: 800 })).toEqual({ remaining: 0, over: true });
    expect(chapterGap(10, { min: null, max: 100 })).toEqual({ remaining: 0, over: false });
    expect(chapterGap(10, undefined)).toEqual({ remaining: 0, over: false });
  });
});

describe("work plan", () => {
  it("plans words a day, counting the day of the deadline", () => {
    const plan = planWork(chapters, 3);
    expect(plan).toMatchObject({ state: "plan", remaining: 600, days: 4, perDay: 150 });
    expect(plan.state === "plan" && plan.rows.map((r) => r.id)).toEqual(["a", "b", "d"]);
  });
  it("is honest without goals, without a deadline, after it and when done", () => {
    expect(planWork([chapters[2]!], 3).state).toBe("noGoals");
    expect(planWork([], 3).state).toBe("noGoals");
    expect(planWork(chapters, null)).toMatchObject({ state: "noDeadline", remaining: 600 });
    expect(planWork(chapters, -2)).toMatchObject({ state: "late", daysLate: 2, remaining: 600 });
    expect(planWork([{ ...chapters[0]!, words: 500 }], 3)).toMatchObject({ state: "done", remaining: 0 });
  });
  it("on the day of the deadline everything is due today", () => {
    expect(planWork(chapters, 0)).toMatchObject({ state: "plan", days: 1, perDay: 600 });
  });
});

describe("planner card", () => {
  const html = (daysLeft: number | null, list = chapters) => renderToStaticMarkup(createElement(WorkPlanner, { chapters: list, daysLeft }));
  it("shows the pace and the chapters", () => {
    const out = html(3);
    expect(out).toContain("oko 150 riječi dnevno");
    expect(out).toContain("1. Uvod: još 300 riječi");
    expect(out).toContain("2. Metoda: iznad najvećeg opsega");
    expect(out).not.toContain("Bez cilja");
  });
  it("says so when there is no deadline or no goal, never a made-up pace", () => {
    expect(html(null)).toContain("dnevni plan nije moguć");
    expect(html(null)).not.toContain("dnevno");
    expect(html(3, [])).toContain("Nema zadanog opsega");
  });
});
