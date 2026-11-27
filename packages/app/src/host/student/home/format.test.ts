// DIZ S-02 (A6): an unreadable instant is left out, never shown as the raw ISO text.
import { describe, expect, it } from "vitest";

import { protoDateTime } from "./format";

describe("protoDateTime", () => {
  it("formats a real instant in Zagreb time", () => {
    expect(protoDateTime("2026-11-30T22:59:00.000Z")).toBe("30. 11. 2026., 23:59");
  });
  it("gives nothing for an unreadable instant, not the raw text", () => {
    expect(protoDateTime("not-a-date")).toBe("");
  });
});
