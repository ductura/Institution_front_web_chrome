import { describe, expect, it } from "vitest";

import { activePlacements, checkDraft, correctedIds, countText, groupByDate, hoursOf, isIsoDate, isSigned, lastEntryDate, placementState, signedThroughOf, signoffsNewestFirst, todayOf } from "./model";
import type { Entry, Placement, Signoff } from "./read";

const P: Placement = { placementId: "p1", mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30", entryCount: 3, signedThrough: null };
const TODAY = "2026-04-15";
const entry = (id: string, date: string, createdAt: string, corrects: string | null = null): Entry => ({ entryId: id, date, hours: 2, text: "Izmišljeni zapis", correctsEntryId: corrects, createdAt });
const sign = (id: string, throughDate: string, signedAt: string): Signoff => ({ signoffId: id, throughDate, entryCount: 1, entriesSha256: "0".repeat(64), comment: null, signedAt, mentor: { id: "t1", givenName: "Mentor", familyName: "Izmišljeni" } });
const draft = (o: Partial<{ date: string; hours: string; text: string }> = {}) => ({ date: "2026-04-10", hours: "1,5", text: "Radila sam na izmišljenom zadatku.", ...o });

describe("checkDraft", () => {
  it("accepts a valid entry and reads the decimal comma", () => {
    expect(checkDraft(draft(), P, TODAY)).toEqual({ ok: true, value: { date: "2026-04-10", hours: 1.5, text: "Radila sam na izmišljenom zadatku." } });
  });
  it.each([
    ["no date", { date: "" }, "date", "dateRequired"],
    ["a date that does not exist", { date: "2026-02-30" }, "date", "dateInvalid"],
    ["a date in the future", { date: "2026-04-16" }, "date", "dateFuture"],
    ["a date before the period", { date: "2026-03-01" }, "date", "dateOutside"],
    ["0 hours", { hours: "0" }, "hours", "hoursInvalid"],
    ["12.5 hours", { hours: "12,5" }, "hours", "hoursInvalid"],
    ["a quarter of an hour", { hours: "0,25" }, "hours", "hoursInvalid"],
    ["hours that are not a number", { hours: "dva" }, "hours", "hoursInvalid"],
    ["only white space", { text: "  \n " }, "text", "textRequired"],
    ["a control character", { text: "a\u0007b" }, "text", "textInvalid"],
    ["a direction override", { text: "a‮b" }, "text", "textInvalid"],
    ["4001 code points", { text: "č".repeat(4001) }, "text", "textTooLong"],
  ] as const)("refuses %s", (_, o, field, error) => {
    expect(checkDraft(draft(o), P, TODAY)).toEqual({ ok: false, field, error });
  });
  it("counts code points, not UTF-16 units, and allows newline and tab", () => {
    expect(checkDraft(draft({ text: "😀".repeat(4000) }), P, TODAY).ok).toBe(true);
    expect(checkDraft(draft({ text: "redak 1\n\tredak 2" }), P, TODAY).ok).toBe(true);
  });
  it("writes the text in NFC", () => {
    const r = checkDraft(draft({ text: "č" }), P, TODAY);
    expect(r.ok && r.value.text).toBe("č");
  });
  it("refuses the 401st entry", () => {
    expect(checkDraft(draft(), { ...P, entryCount: 400 }, TODAY)).toEqual({ ok: false, field: "form", error: "full" });
  });
});

describe("placements", () => {
  it("is active inside the period only", () => {
    expect(placementState(P, "2026-03-01")).toBe("upcoming");
    expect(placementState(P, "2026-03-02")).toBe("active");
    expect(placementState(P, "2026-06-30")).toBe("active");
    expect(placementState(P, "2026-07-01")).toBe("ended");
    expect(activePlacements([P], "2026-07-01")).toEqual([]);
  });
  it("allows entries up to today, or to the end of the period", () => {
    expect(lastEntryDate(P, TODAY)).toBe(TODAY);
    expect(lastEntryDate(P, "2026-09-01")).toBe("2026-06-30");
  });
  it("reads dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-2-8")).toBe(false);
    expect(todayOf(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("agrees with the plural forms", () => {
    const f = { one: "{n} zapis", few: "{n} zapisa", many: "{n} zapisa" };
    expect([1, 2, 5, 11, 21].map((n) => countText(n, f))).toEqual(["1 zapis", "2 zapisa", "5 zapisa", "11 zapisa", "21 zapis"]);
  });
  it("takes only the allowed hours", () => {
    expect(hoursOf("12")).toBe(12);
    expect(hoursOf(" 0.5 ")).toBe(0.5);
    expect(hoursOf("")).toBeNull();
  });
});

describe("entries and signatures", () => {
  const a = entry("a", "2026-04-01", "2026-04-01T10:00:00Z");
  const b = entry("b", "2026-04-03", "2026-04-03T10:00:00Z");
  const c = entry("c", "2026-04-01", "2026-04-09T10:00:00Z", "a");
  it("groups by date, newest day first, each day in writing order", () => {
    expect(groupByDate([a, b, c]).map((d) => [d.date, d.entries.map((e) => e.entryId)])).toEqual([["2026-04-03", ["b"]], ["2026-04-01", ["a", "c"]]]);
  });
  it("marks what a correction replaces", () => {
    expect([...correctedIds([a, b, c])]).toEqual(["a"]);
  });
  it("signs the entries up to the date that existed at signing; a later entry for an older date is not signed", () => {
    const s = sign("s1", "2026-04-05", "2026-04-06T08:00:00Z");
    expect([a, b, c].map((e) => isSigned(e, [s]))).toEqual([true, true, false]);
    expect(isSigned(a, [])).toBe(false);
  });
  it("takes the latest date and the newest signature", () => {
    const s1 = sign("s1", "2026-04-05", "2026-04-06T08:00:00Z");
    const s2 = sign("s2", "2026-04-20", "2026-04-21T08:00:00Z");
    expect(signedThroughOf([s1, s2])).toBe("2026-04-20");
    expect(signedThroughOf([])).toBeNull();
    expect(signoffsNewestFirst([s1, s2]).map((s) => s.signoffId)).toEqual(["s2", "s1"]);
  });
});
