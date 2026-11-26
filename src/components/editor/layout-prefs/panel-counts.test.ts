import { describe, expect, it } from "vitest";

import { openCommentsLabel } from "./panel-counts";

// ED-38 (P2-7): the phrase a screen reader hears after "Komentari". Where the count comes from (the
// comments card reporting to the right panel) is covered by e2e/brojac-komentara.spec.ts.
describe("open comments label", () => {
  it("says the count in Croatian with the right plural", () => {
    expect(openCommentsLabel(1)).toBe("1 otvoren komentar");
    expect(openCommentsLabel(3)).toBe("3 otvorena komentara");
    expect(openCommentsLabel(5)).toBe("5 otvorenih komentara");
    expect(openCommentsLabel(12)).toBe("12 otvorenih komentara");
    expect(openCommentsLabel(21)).toBe("21 otvoren komentar");
  });
});
