import { describe, expect, it } from "vitest";

import { messagesEn } from "@/lib/i18n/messages.en";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";

const leaves = (value: unknown): string[] =>
  typeof value === "string" ? [value] : Object.values(value as object).flatMap(leaves);

describe("WEB-18 course codes copy", () => {
  it("uses no word from the forbidden vocabulary, in either language", () => {
    for (const text of [...leaves(messagesHr.teacherCourseCodes), ...leaves(messagesEn.teacherCourseCodes)]) {
      expect(findForbiddenTerms(text).map((term) => term.entry), text).toEqual([]);
    }
  });

  it("tells a teacher without a course that the administrator creates courses (A-7)", () => {
    expect(messagesHr.teacherCourseCodes.emptyBody).toContain("administrator fakulteta");
  });
});
