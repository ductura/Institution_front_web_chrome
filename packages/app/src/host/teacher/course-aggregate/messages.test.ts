import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { courseAggregateMessages } from "./messages.hr";

describe("course-aggregate texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(courseAggregateMessages)) {
      if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    }
    const text = [courseAggregateMessages.shareOf(6, 24, 25), courseAggregateMessages.chartPart("Predano", 75), courseAggregateMessages.chartPartHidden("Predano"), courseAggregateMessages.chartAlt(["a"])];
    for (const t of text) expect(findForbiddenTerms(t, "hr")).toEqual([]);
  });
});
