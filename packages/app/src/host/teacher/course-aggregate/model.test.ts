import { describe, expect, it } from "vitest";

import { FAKE_AGGREGATE, FAKE_ASSIGNMENTS, fakeCourseAggregatePort } from "./fake-port";
import { aggregateScope, aggregateView, loadAggregate, measureView, MEASURES, MIN_STUDENTS, type AggregateRead, type MeasureKey } from "./model";
import { courseAggregateMessages as text } from "./messages.hr";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

describe("course aggregate (WEB-1706)", () => {
  it("shows shares of the closed list of measures, with a text alternative of the chart", async () => {
    const view = await loadAggregate(fakeCourseAggregatePort(), ID, FAKE_ASSIGNMENTS);
    if (view.kind !== "ready") throw new Error("expected ready");
    expect(view.measures.map((m) => m.key)).toEqual([...MEASURES]);
    expect(view.measures[0]).toMatchObject({ shown: true, percent: 75 });
    expect(view.chartAlt).toContain("Predano: 75 %.");
    expect(view.chartAlt.startsWith("Grafikon udjela.")).toBe(true);
  });

  it("has its own state below the threshold and shows no number", () => {
    const read: AggregateRead = { kind: "ready", data: { students: MIN_STUDENTS - 1, counts: { submitted: 2, inProgress: 1, notStarted: 1 } } };
    expect(aggregateView(read)).toEqual({ kind: "suppressed" });
    expect(aggregateView({ kind: "suppressed" })).toEqual({ kind: "suppressed" });
    expect(text.suppressedTitle).toBe("Premalo studenata za prikaz");
  });

  it("hides a measure whose group or complement is below the threshold", () => {
    expect(measureView("submitted", 4, 20).shown).toBe(false);
    expect(measureView("submitted", 18, 20).shown).toBe(false);
    expect(measureView("submitted", 5, 10).shown).toBe(true);
    expect(measureView("submitted", 11, 10).shown).toBe(false);
    expect(measureView("submitted", -1, 10).shown).toBe(false);
  });

  it("carries no name, no scale and no ranking in its view", async () => {
    const view = await loadAggregate(fakeCourseAggregatePort(), ID, FAKE_ASSIGNMENTS);
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/name|ime|rank|grade|ocjen|score/i);
  });

  it("maps empty, signed-out, unavailable and failures without inventing values", async () => {
    expect(aggregateView({ kind: "ready", data: { ...FAKE_AGGREGATE, students: 0 } })).toEqual({ kind: "empty" });
    expect(aggregateView({ kind: "signedOut" })).toEqual({ kind: "signedOut" });
    expect(aggregateView({ kind: "unavailable" })).toEqual({ kind: "unavailable" });
    expect(await loadAggregate({ read: async () => { throw new Error("x"); } }, ID, FAKE_ASSIGNMENTS)).toEqual({ kind: "unavailable" });
  });

  it("leaves practice assignments out of the course aggregate (P-D1)", async () => {
    const port = fakeCourseAggregatePort();
    const view = await loadAggregate(port, ID, FAKE_ASSIGNMENTS);
    expect(port.asked).toEqual([["00000000-0000-4000-8000-0000000000d1", "00000000-0000-4000-8000-0000000000d3"]]);
    expect(port.asked.flat()).not.toContain("00000000-0000-4000-8000-0000000000d2");
    expect(view).toMatchObject({ kind: "ready", practiceLeftOut: 1 });
    expect(aggregateScope([{ assignmentId: "a", isPractice: true }, { assignmentId: "b", isPractice: false }, { assignmentId: "c" }])).toEqual(["b", "c"]);
  });

  it("reads nothing for a course with practice assignments only, and says so calmly", async () => {
    const port = fakeCourseAggregatePort();
    expect(await loadAggregate(port, ID, [{ assignmentId: "a", isPractice: true }])).toEqual({ kind: "practiceOnly" });
    expect(await loadAggregate(port, ID, [])).toEqual({ kind: "empty" });
    expect(port.asked).toEqual([]);
    expect(text.practiceOnly).toContain("Probni zadaci ne ulaze u zbirni pregled");
  });

  const ready = (notStarted: number, inProgress: number, submitted: number): AggregateRead =>
    ({ kind: "ready", data: { students: notStarted + inProgress + submitted, counts: { notStarted, inProgress, submitted } } });
  const shownOf = (read: AggregateRead) => {
    const view = aggregateView(read);
    if (view.kind !== "ready") throw new Error("expected ready");
    return Object.fromEntries(view.measures.map((m) => [m.key, m.shown ? m.count : null])) as Record<MeasureKey, number | null>;
  };

  it("hides the other measures when one is hidden, so the total cannot give it away (3/7/10 of 20)", () => {
    expect(shownOf(ready(3, 7, 10))).toEqual({ submitted: null, inProgress: null, notStarted: null });
    const view = aggregateView(ready(3, 7, 10));
    if (view.kind !== "ready") throw new Error("expected ready");
    expect(view.chartAlt).not.toMatch(/\d/);
    expect(JSON.stringify(view)).not.toMatch(/"count"/);
  });

  it("with two hidden measures shows the third neither, so they cannot be worked out (4/4/12 of 20, 4/4/5 of 13)", () => {
    expect(shownOf(ready(4, 4, 12))).toEqual({ submitted: null, inProgress: null, notStarted: null });
    expect(shownOf(ready(4, 4, 5))).toEqual({ submitted: null, inProgress: null, notStarted: null });
    expect(shownOf(ready(5, 5, 10))).toEqual({ submitted: 10, inProgress: 5, notStarted: 5 });
  });

  it("leaves no hidden measure computable from the shown counts and the total, for any course of up to 60 students", () => {
    for (let students = MIN_STUDENTS; students <= 60; students++) {
      const seen = new Map<string, Map<MeasureKey, Set<number>>>();
      for (let a = 0; a <= students; a++) for (let b = 0; a + b <= students; b++) {
        const counts: Record<MeasureKey, number> = { notStarted: a, inProgress: b, submitted: students - a - b };
        const view = aggregateView({ kind: "ready", data: { students, counts } });
        if (view.kind !== "ready") continue;
        const key = JSON.stringify(view);
        const hidden = seen.get(key) ?? new Map<MeasureKey, Set<number>>();
        for (const m of view.measures) if (!m.shown) hidden.set(m.key, (hidden.get(m.key) ?? new Set()).add(counts[m.key]));
        seen.set(key, hidden);
      }
      for (const [key, hidden] of seen) for (const [measure, values] of hidden) {
        expect({ students, key, measure, values: values.size > 1 }).toEqual({ students, key, measure, values: true });
      }
    }
  });
});
