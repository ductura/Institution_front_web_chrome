import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms";
import { whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";

describe("what is recorded dialog", () => {
  it("keeps the P-1 wording and clear of forbidden terms", () => {
    expect(t.rhythm.toggle).toBe("Bilježi ritam tipkanja");
    // Daniel 22. 11. 2026.: only the teacher turns the rhythm off; the dialog does not offer it to the student.
    expect(t.rhythm.text).not.toMatch(/možeš ga isključiti/i);
    expect(t.rhythm.text).toContain("nastavnik");
    expect(t.note).toBe("Ništa od ovoga nije ocjena ni tvrdnja o autorstvu.");
    expect(findForbiddenTerms(JSON.stringify(t), "hr")).toEqual([]);
  });
});
