import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { commentsHr } from "./messages.hr";

const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : typeof v === "function" ? [String((v as (...a: never[]) => unknown)(...([1, 1] as never[])))]
    : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("comments texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of strings(commentsHr)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
