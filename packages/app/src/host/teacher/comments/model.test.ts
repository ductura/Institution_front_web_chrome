import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { teacherCommentsMessages } from "./messages.hr";
import { entryWho, threadTitle } from "./model";

describe("teacher comments model", () => {
  it("titles a thread with its quote and cuts a long one", () => {
    expect(threadTitle("Ovaj odnos dodatno slabi")).toBe("Komentar uz „Ovaj odnos dodatno slabi”");
    expect(threadTitle("a".repeat(60))).toBe(`Komentar uz „${"a".repeat(40)}…”`);
    expect(threadTitle(null)).toBe("Komentari i prijedlozi");
  });
  it("names the author by role, own entries as Vi", () => {
    const base = { createdWindow: "2026-11-03T08:15:00.000Z" };
    expect(entryWho({ ...base, isOwn: true, role: "teacher" })).toMatch(/^Vi · /);
    expect(entryWho({ ...base, isOwn: false, role: "student" })).toMatch(/^Student · /);
    expect(entryWho({ ...base, isOwn: false, role: "teacher" })).toMatch(/^Nastavnik · /);
  });
  it("holds no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(teacherCommentsMessages)) {
      if (typeof value === "string") expect(findForbiddenTerms(value, "hr")).toEqual([]);
    }
  });
  it("uses the prototype wording", () => {
    expect(teacherCommentsMessages.resolve).toBe("Označi kao riješeno");
    expect(teacherCommentsMessages.empty).toBe("Još nema komentara.");
    expect(teacherCommentsMessages.added).toBe("Komentar je dodan. Isti komentar vidi i student.");
  });
});
