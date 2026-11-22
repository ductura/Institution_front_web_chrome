import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms";
import { whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";

describe("what is recorded dialog", () => {
  it("keeps the P-1 wording and clear of forbidden terms", () => {
    expect(t.rhythm.toggle).toBe("Bilježi ritam tipkanja");
    expect(t.note).toBe("Ništa od ovoga nije ocjena ni tvrdnja o autorstvu.");
    expect(findForbiddenTerms(JSON.stringify(t), "hr")).toEqual([]);
  });
});
