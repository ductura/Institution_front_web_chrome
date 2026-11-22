import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms";
import { whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";
import { readRhythm, writeRhythm } from "./rhythm";

describe("what is recorded dialog", () => {
  it("keeps rhythm on by default and stores the student's choice", () => {
    expect(readRhythm(() => null)).toBe(true);
    let stored = "";
    writeRhythm(false, (v) => { stored = v; });
    expect(readRhythm(() => stored)).toBe(false);
    expect(readRhythm(() => { throw new Error("blocked"); })).toBe(true);
  });

  it("keeps the P-1 wording and clear of forbidden terms", () => {
    expect(t.rhythm.toggle).toBe("Bilježi ritam tipkanja");
    expect(t.note).toBe("Ništa od ovoga nije ocjena ni tvrdnja o autorstvu.");
    expect(findForbiddenTerms(JSON.stringify(t), "hr")).toEqual([]);
  });
});
