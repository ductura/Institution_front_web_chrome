import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { commentBankMessages } from "./messages.hr";

describe("comment-bank texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(commentBankMessages)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
