import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Deadlines, Thread } from "./LeftSectionsHost";
import { leftHr } from "./messages.hr";

// WEB-2126: server rendering runs no effects and holds no storage, so these are the empty states.
describe("left panel sections, empty", () => {
  it("Rokovi say what the server has not given and offer own deadlines", () => {
    const html = renderToStaticMarkup(createElement(Deadlines, { workId: "w", now: new Date(2026, 10, 22) }));
    expect(html).toContain(leftHr.deadlines.submissionUnavailable);
    expect(html).toContain(leftHr.deadlines.ownEmpty);
    expect(html).toContain(leftHr.deadlines.add);
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
