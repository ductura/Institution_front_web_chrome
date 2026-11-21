import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { documentHistoryMessages as m } from "./messages.hr";

describe("document-history texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(m)) if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    for (const t of [m.importedAt("10. 11. 2026."), m.claimOf(m.creator, "Izmišljena Osoba")]) expect(findForbiddenTerms(t, "hr")).toEqual([]);
  });
});
