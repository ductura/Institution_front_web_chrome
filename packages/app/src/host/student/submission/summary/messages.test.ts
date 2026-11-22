import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { summaryText } from "./messages.hr";

const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : typeof value === "object" && value !== null ? Object.values(value).flatMap(strings) : [];

describe("summary panel texts (WEB-2108)", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    const all = strings(summaryText);
    expect(all.length).toBeGreaterThan(50);
    for (const text of all) expect({ text, hits: findForbiddenTerms(text, "hr") }).toEqual({ text, hits: [] });
  });
});
