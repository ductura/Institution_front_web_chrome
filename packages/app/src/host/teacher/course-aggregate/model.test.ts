import { describe, expect, it } from "vitest";

import { FAKE_AGGREGATE, FAKE_ASSIGNMENTS, fakeCourseAggregatePort } from "./fake-port";
import { aggregateScope, aggregateView, loadAggregate, measureView, MEASURES, MIN_STUDENTS, type AggregateRead } from "./model";
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
    const read: AggregateRead = { kind: "ready", data: { students: MIN_STUDENTS - 1, counts: { submitted: 4, afterDeadline: 0, continuous: 3, withGaps: 1 } } };
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
});
