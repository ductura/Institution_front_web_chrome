// WEB-DIZ-B-V13 (A4): the time of a revision for people. Invented instants only.
import { describe, expect, it } from "vitest";

import { humanTime } from "./human-time.ts";

describe("humanTime", () => {
  it("writes the whole month in the genitive and \"u\" before the hour, in Zagreb time", () => {
    expect(humanTime("2026-12-08T20:14:00.000Z")).toBe("8. prosinca 2026. u 21:14");
    expect(humanTime("2026-11-12T08:05:00Z")).toBe("12. studenoga 2026. u 09:05");
    expect(humanTime("2026-07-01T22:30:00Z")).toBe("2. srpnja 2026. u 00:30"); // summer time, past midnight
  });

  it("is empty for text that is no instant, never a raw ISO string", () => {
    expect(humanTime("nije vrijeme")).toBe("");
    expect(humanTime("")).toBe("");
  });
});
