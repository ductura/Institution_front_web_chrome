import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { hostText } from "./text";

describe("host texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(hostText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
