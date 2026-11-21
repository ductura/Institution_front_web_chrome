import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { keyDatesMessages } from "./messages.hr";

describe("key-dates texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(keyDatesMessages)) {
      if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    }
    expect(findForbiddenTerms(keyDatesMessages.at(14, 12, 2026, "23:59"), "hr")).toEqual([]);
  });
});
