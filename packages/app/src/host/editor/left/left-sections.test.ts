import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Deadlines, dueLine, railFootLine, Thread } from "./LeftSectionsHost";
import { leftHr } from "./messages.hr";

// WEB-2126: server rendering runs no effects and holds no storage, so these are the empty states.
describe("left panel sections, empty", () => {
  it("Rokovi say what the server has not given and offer own deadlines", () => {
    const html = renderToStaticMarkup(createElement(Deadlines, { workId: "w", now: new Date(2026, 10, 22) }));
    expect(html).toContain(leftHr.deadlines.submissionUnavailable);
    expect(html).toContain(leftHr.deadlines.ownEmpty);
    expect(html).toContain(leftHr.deadlines.add);
  });
  it("ED-37: Rokovi and Napredak show the assignment's submission deadline and the days to it", () => {
    // 23:59 in Zagreb on 25 November is 22:59 UTC; the day counts in Zagreb, not in UTC.
    const dueAt = "2026-11-25T22:59:00.000Z";
    const now = new Date(2026, 10, 22, 10, 0);
    const rokovi = renderToStaticMarkup(createElement(Deadlines, { workId: "w", dueAt, now }));
    expect(rokovi).toContain("25. 11. 2026., 23:59 · za 3 dana");
    expect(rokovi).not.toContain(leftHr.deadlines.submissionUnavailable);
    // Napredak reads the editor, so its line is checked through the same dueLine.
    expect(dueLine(dueAt, now)).toBe("25. 11. 2026., 23:59 · za 3 dana");
  });
  it("ED-37: a past or unreadable deadline is said so, never invented", () => {
    const now = new Date(2026, 10, 22, 10, 0);
    const late = renderToStaticMarkup(createElement(Deadlines, { workId: "w", dueAt: "2026-11-20T22:59:00.000Z", now }));
    expect(late).toContain(leftHr.deadlines.late(2));
    const broken = renderToStaticMarkup(createElement(Deadlines, { workId: "w", dueAt: "nije datum", now }));
    expect(broken).toContain(leftHr.deadlines.submissionUnavailable);
    expect(dueLine(null, now)).toBeNull();
    expect(dueLine("nije datum", now)).toBeNull();
  });
  it("ED-37: the rail footer sets the words against the assignment's range and counts the days to the deadline", () => {
    const now = new Date(2026, 10, 22, 10, 0);
    const dueAt = "2026-11-25T22:59:00.000Z";
    expect(railFootLine(1200, { min: 3000, max: 5000 }, dueAt, now)).toBe("1200 od 3000 do 5000 riječi · za 3 dana");
    expect(railFootLine(1200, null, "2026-11-20T22:59:00.000Z", now)).toBe("1200 riječi · prošlo je 2 dana");
    // Without a range or a readable deadline only what is known is said.
    expect(railFootLine(0, null, null, now)).toBe("0 riječi");
    expect(railFootLine(10, { min: 100, max: 200 }, "nije datum", now)).toBe("10 od 100 do 200 riječi");
  });
  it("Nit rada says the question is not written and lists no hypotheses", () => {
    const html = renderToStaticMarkup(createElement(Thread, { workId: "w" }));
    expect(html).toContain(leftHr.thesis.empty);
    expect(html).toContain(leftHr.thread.noHypotheses);
  });
  it("counts days in Croatian", () => {
    expect(leftHr.deadlines.in(0)).toBe("danas");
    expect(leftHr.deadlines.in(1)).toBe("za 1 dan");
    expect(leftHr.deadlines.in(12)).toBe("za 12 dana");
    expect(leftHr.deadlines.late(1)).toBe("prošao je 1 dan");
  });
});
