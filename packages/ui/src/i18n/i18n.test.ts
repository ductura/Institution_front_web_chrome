import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";

import { formatDate, formatDateTime, formatNumber, formatTime, keyGaps, uiMessagesEn, uiMessagesFor, uiMessagesHr, zagrebWall } from ".";

const none = { missing: [], extra: [], placeholders: [] };

function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "function") return [String((node as (a: number, b: number) => string)(1, 2))];
  if (node !== null && typeof node === "object") return Object.values(node).flatMap(texts);
  return [];
}

describe("keyGaps", () => {
  it.each([
    ["the same keys", { a: "A", b: { c: "C" } }, { a: "X", b: { c: "Y" } }, none],
    ["a missing key", { a: "A", b: "B" }, { a: "A" }, { ...none, missing: ["b"] }],
    ["an extra key", { a: "A" }, { a: "A", z: "Z" }, { ...none, extra: ["z"] }],
    ["a missing nested key", { s: { a: "A", b: "B" } }, { s: { a: "A" } }, { ...none, missing: ["s.b"] }],
    ["a shorter list", { l: ["one", "two"] }, { l: ["one"] }, { ...none, missing: ["l.1"] }],
    ["a renamed placeholder", { a: "{n} of {m}" }, { a: "{n} of {total}" }, { ...none, placeholders: ["a"] }],
    ["placeholders in another order", { a: "{a} {b}" }, { a: "{b}: {a}" }, none],
    ["a function of other arity", { f: (a: number) => `${a}` }, { f: (a: number, b: number) => `${a}${b}` }, { ...none, placeholders: ["f"] }],
    ["a text where a function stands", { f: (a: number) => `${a}` }, { f: "F" }, { ...none, missing: ["f"], extra: ["f"] }],
    ["a value that is not text", { a: "A" }, { a: 1 }, { ...none, missing: ["a"] }],
  ])("reports %s", (_, reference, other, gaps) => {
    expect(keyGaps(reference, other)).toEqual(gaps);
  });
});

describe("UI package texts", () => {
  it("English has every key and placeholder of Croatian, and no other", () => {
    expect(keyGaps(uiMessagesHr, uiMessagesEn)).toEqual(none);
  });

  it("picks the table of the language", () => {
    expect(uiMessagesFor("hr").diff.added).toBe("Dodano");
    expect(uiMessagesFor("en").diff.added).toBe("Added");
    expect(uiMessagesFor("en").timeline.step(3, 9)).toBe("Step 3 of 9");
  });

  it("holds no empty text and no forbidden term (Ductus PRODUCT §5)", () => {
    for (const text of texts(uiMessagesEn)) {
      expect(text.trim()).not.toBe("");
      expect(findForbiddenTerms(text, "en"), text).toEqual([]);
    }
  });
});

describe("dates by language, in Zagreb time", () => {
  // 13:05 UTC in November is 14:05 in Zagreb (CET); in July it is 15:05 (CEST).
  const winter = "2026-11-21T13:05:00Z";
  const summer = "2026-07-01T13:05:00Z";

  it("writes the date in each language", () => {
    expect(formatDate(winter, "hr")).toBe("21. studenoga 2026.");
    expect(formatDate(winter, "en")).toBe("21 November 2026");
  });

  it("writes the time on a 24-hour Zagreb clock", () => {
    expect(formatTime(winter)).toBe("14:05");
    expect(formatTime(summer)).toBe("15:05");
    expect(formatDateTime(winter, "hr")).toBe("21. studenoga 2026. u 14:05");
    expect(formatDateTime(winter, "en")).toBe("21 November 2026 at 14:05");
  });

  it("takes the Zagreb day at midnight, not the device's", () => {
    expect(formatDate("2026-12-31T23:30:00Z", "en")).toBe("1 January 2027");
    expect(zagrebWall("2026-12-31T23:30:00Z")).toEqual({ year: 2027, month: 1, day: 1, hour: 0, minute: 30 });
  });

  it("gives nothing for an invalid instant", () => {
    expect(formatDate("not a date", "hr")).toBe("");
    expect(formatDateTime(Number.NaN, "en")).toBe("");
  });
});

describe("numbers by language", () => {
  it.each([
    [1234567.5, "1.234.567,5", "1,234,567.5"],
    [0.25, "0,25", "0.25"],
    [-1234, "-1.234", "-1,234"],
    [999, "999", "999"],
  ])("writes %d", (value, hr, en) => {
    expect(formatNumber(value, "hr")).toBe(hr);
    expect(formatNumber(value, "en")).toBe(en);
  });

  it("fixes the fraction digits when asked", () => {
    expect(formatNumber(12.5, "hr", 2)).toBe("12,50");
    expect(formatNumber(12.5, "en", 0)).toBe("13");
    expect(formatNumber(-0.001, "en", 1)).toBe("0.0");
  });

  it("gives nothing for a value that is not finite", () => {
    expect(formatNumber(Number.POSITIVE_INFINITY, "hr")).toBe("");
  });
});
