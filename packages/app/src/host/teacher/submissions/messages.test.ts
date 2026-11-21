import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { submissionsMessages } from "./messages.hr";

describe("submissions texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    const all = [...Object.values(submissionsMessages), ...Object.values(submissionsMessages.columns)];
    for (const value of all) if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
