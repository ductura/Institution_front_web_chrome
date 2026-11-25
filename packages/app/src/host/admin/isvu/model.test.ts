import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { isvuImportMessages } from "./messages.hr";
import {
  countByStatus, countsSummary, hasNewStudents, ISVU_ROW_REASONS, ISVU_ROW_STATUSES, reasonText, statusText,
} from "./model";

const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : typeof v === "function" ? [String((v as (...a: never[]) => unknown)(...([1] as never[])))]
    : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("ISVU import model", () => {
  it("gives every one of the 8 reasons its own non-empty text", () => {
    expect(ISVU_ROW_REASONS).toHaveLength(8);
    const texts = ISVU_ROW_REASONS.map(reasonText);
    for (const t of texts) expect(t).not.toBe(isvuImportMessages.unknownReason);
    expect(new Set(texts).size).toBe(8);
  });
  it("gives every state a text and never renders an unknown reason as empty", () => {
    expect(new Set(ISVU_ROW_STATUSES.map(statusText)).size).toBe(3);
    expect(reasonText(undefined)).toBe(isvuImportMessages.unknownReason);
    expect(reasonText("nešto_novo")).toBe(isvuImportMessages.unknownReason);
    expect(reasonText("constructor")).toBe(isvuImportMessages.unknownReason);
  });
  it("totals per state and counts unknown states as unsuitable", () => {
    const c = countByStatus([{ status: "new" }, { status: "new" }, { status: "already_enrolled" }, { status: "unsuitable", reason: "removed" }, { status: "x" }]);
    expect(c).toEqual({ new: 2, already_enrolled: 1, unsuitable: 2, total: 5 });
    expect(countsSummary(c)).toEqual(["Novi: 2", "Već upisani: 1", "Neodgovarajući: 2", "Ukupno redaka: 5"]);
    expect(hasNewStudents(c)).toBe(true);
    expect(hasNewStudents(countByStatus([{ status: "already_enrolled" }]))).toBe(false);
    expect(countByStatus([]).total).toBe(0);
  });
  it("holds no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of strings(isvuImportMessages)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
