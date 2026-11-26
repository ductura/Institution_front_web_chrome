import { describe, expect, it } from "vitest";

import { checkDraft, countText, linesOf, MAX_MATERIALS, MAX_TEXT, MAX_TITLE } from "./model";

const OK = { title: "Intervju A", kind: "interview", text: "Izmišljeni tekst intervjua." };

describe("checkDraft", () => {
  it("accepts a title, a kind and a text, and normalises them", () => {
    expect(checkDraft({ ...OK, title: "  Intervju A  " }, 0)).toEqual({ ok: true, value: { title: "Intervju A", kind: "interview", text: OK.text } });
  });
  it("refuses an empty or blank title and text", () => {
    expect(checkDraft({ ...OK, title: "   " }, 0)).toMatchObject({ ok: false, field: "title", error: "titleRequired" });
    expect(checkDraft({ ...OK, text: " \n\t " }, 0)).toMatchObject({ ok: false, field: "text", error: "textRequired" });
  });
  it("refuses a kind outside the closed set", () => {
    expect(checkDraft({ ...OK, kind: "audio" }, 0)).toMatchObject({ ok: false, field: "kind", error: "kindInvalid" });
    expect(checkDraft({ ...OK, kind: "" }, 0)).toMatchObject({ ok: false, field: "kind" });
  });
  it("counts characters, not UTF-16 units, at the bounds", () => {
    expect(checkDraft({ ...OK, title: "a".repeat(MAX_TITLE) }, 0).ok).toBe(true);
    expect(checkDraft({ ...OK, title: "a".repeat(MAX_TITLE + 1) }, 0)).toMatchObject({ error: "titleTooLong" });
    expect(checkDraft({ ...OK, text: "😀".repeat(MAX_TEXT) }, 0).ok).toBe(true);
    expect(checkDraft({ ...OK, text: "a".repeat(MAX_TEXT + 1) }, 0)).toMatchObject({ error: "textTooLong" });
  });
  it("refuses control and bidi characters, but allows line breaks and tabs in the text", () => {
    expect(checkDraft({ ...OK, text: "a\u0000b" }, 0)).toMatchObject({ error: "textInvalid" });
    expect(checkDraft({ ...OK, text: "a‮b" }, 0)).toMatchObject({ error: "textInvalid" });
    expect(checkDraft({ ...OK, title: "a\nb" }, 0)).toMatchObject({ error: "titleInvalid" });
    expect(checkDraft({ ...OK, text: "prvi\r\ndrugi\tkraj" }, 0).ok).toBe(true);
  });
  it("refuses a new one at the largest number of materials", () => {
    expect(checkDraft(OK, MAX_MATERIALS - 1).ok).toBe(true);
    expect(checkDraft(OK, MAX_MATERIALS)).toMatchObject({ ok: false, field: "form", error: "full" });
  });
});

describe("linesOf and countText", () => {
  it("splits on every kind of line break and keeps the empty lines in place", () => {
    expect(linesOf("a\r\nb\n\nc\rd")).toEqual(["a", "b", "", "c", "d"]);
  });
  it("picks the Croatian plural form", () => {
    const f = { one: "{n} znak", few: "{n} znaka", many: "{n} znakova" };
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => countText(n, f))).toEqual(["1 znak", "2 znaka", "5 znakova", "11 znakova", "12 znakova", "21 znak", "22 znaka", "25 znakova", "111 znakova"]);
  });
});
