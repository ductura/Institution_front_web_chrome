import { describe, expect, it } from "vitest";

import { RECHECK_LIMIT, RECHECK_START, afterUnanswered, answered, startRead } from "./recheck";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-9): an unknown outcome is read again at most three times.
describe("recheck", () => {
  it("counts the reads that did not answer and gives up after the third", () => {
    let state = RECHECK_START;
    expect(state.attempt).toBe(1);
    for (let n = 1; n < RECHECK_LIMIT; n++) {
      state = afterUnanswered(startRead(state)!);
      expect(state).toEqual({ attempt: n + 1, reading: false, gaveUp: false });
    }
    state = afterUnanswered(startRead(state)!);
    expect(state.gaveUp).toBe(true);
    expect(startRead(state)).toBeNull();
  });

  it("never starts a second read while one is on its way", () => {
    const reading = startRead(RECHECK_START)!;
    expect(reading.reading).toBe(true);
    expect(startRead(reading)).toBeNull();
  });

  it("an answer is the server's state, an ended session or a work not found; anything else is unanswered", () => {
    expect(answered({ kind: "none" })).toBe(true);
    expect(answered({ kind: "ceka", revision: 2, requestedAt: "2026-11-20T09:00:00.000000Z" })).toBe(true);
    expect(answered({ kind: "session-expired" })).toBe(true);
    expect(answered({ kind: "greska", code: "not_found" })).toBe(true);
    expect(answered({ kind: "nepoznato" })).toBe(false);
    expect(answered({ kind: "greska", code: "invalid" })).toBe(false);
  });
});
