import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { checksText, summaryText } from "./messages.hr";

const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : typeof value === "object" && value !== null ? Object.values(value).flatMap(strings) : [];

describe("summary panel texts (WEB-2108)", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    const all = [...strings(summaryText), ...strings(checksText)];
    expect(all.length).toBeGreaterThan(50);
    // Ustav v1.6 C-6: the notice „nije dokaz autorstva” is required beside percentages; only that negation is let through.
    for (const text of all.map((x) => x.replaceAll("nije dokaz autorstva", ""))) expect({ text, hits: findForbiddenTerms(text, "hr") }).toEqual({ text, hits: [] });
    expect(findForbiddenTerms("Ovo je dokaz autorstva.", "hr")).not.toEqual([]);
  });
});
