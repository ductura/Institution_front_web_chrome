import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { whoOpenedMessages } from "./messages.hr";

describe("who-opened texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(whoOpenedMessages)) {
      if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    }
    expect(findForbiddenTerms(whoOpenedMessages.windowOf("14:10", "14:15"), "hr")).toEqual([]);
  });
});
