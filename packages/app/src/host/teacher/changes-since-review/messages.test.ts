import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { changesMessages } from "./messages.hr";

describe("changes-since-review texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(changesMessages)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
