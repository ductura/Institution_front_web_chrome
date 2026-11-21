import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { restoreMessages as m } from "./messages.hr";

describe("restore texts (WEB-1907)", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(m)) if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    for (const t of [m.version(2), m.confirm(2), m.done(1, 4)]) expect(findForbiddenTerms(t, "hr")).toEqual([]);
  });
});
