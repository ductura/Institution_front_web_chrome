// WEB-NUZ-NZ NZ-2: an extension is offered for an assignment whose deadline has passed (Daniel, NF-4 odluka 5);
// the separate late-submission exception (NZ-5 varijanta B) has no server route and says so.
import { describe, expect, it } from "vitest";

import { deadlinePassed } from "./model";
import { n13Messages as m } from "./messages.hr";

const NOW = Date.parse("2026-11-24T10:00:00.000Z");

describe("N-13 passed deadline (NZ-2)", () => {
  it("knows a passed deadline and stays quiet without one", () => {
    expect(deadlinePassed({ task: "Esej", course: "A", dueAt: "2026-11-08T22:59:00.000Z" }, NOW)).toBe(true);
    expect(deadlinePassed({ task: "Esej", course: "A", dueAt: "2026-12-15T22:59:00.000Z" }, NOW)).toBe(false);
    expect(deadlinePassed({ task: null, course: null, dueAt: null }, NOW)).toBe(false);
    expect(deadlinePassed({ task: null, course: null, dueAt: "nije datum" }, NOW)).toBe(false);
  });
  it("says the prototype's banner and that variant B is not available yet", () => {
    expect(m.passedTitle).toBe("Rok ovog zadatka je prošao.");
    expect(m.passedBody).toBe("Produljenje je i dalje moguće: student koji nije predao može predati do novog roka.");
    expect(m.exceptionUnavailable).toMatch(/još nije dostupna/);
  });
});
