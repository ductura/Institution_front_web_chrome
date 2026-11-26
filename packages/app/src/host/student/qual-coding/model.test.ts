import { describe, expect, it } from "vitest";

import { checkCode, checkMark, orderSegments, wholeParagraph } from "./model";
import type { Code, Segment } from "./read";

const code = (id: string, name: string, order: number): Code => ({ id, name, description: "", order });
const CODES = [code("c1", "Motivacija", 0), code("c2", "Prepreke", 1)];
const LINES = ["Prvi izmišljeni redak.", "", "  Drugi redak s razmakom  "];

describe("checkCode", () => {
  it("trims, accepts and leaves an empty description out", () => {
    expect(checkCode({ name: "  Nada ", description: "" }, CODES)).toEqual({ ok: true, value: { name: "Nada" } });
    expect(checkCode({ name: "Nada", description: " kratko " }, CODES)).toEqual({ ok: true, value: { name: "Nada", description: "kratko" } });
  });
  it("refuses an empty, long, odd or taken name (case aside) and a long description", () => {
    expect(checkCode({ name: "  ", description: "" }, CODES)).toMatchObject({ ok: false, error: "nameRequired" });
    expect(checkCode({ name: "a".repeat(81), description: "" }, CODES)).toMatchObject({ ok: false, error: "nameTooLong" });
    expect(checkCode({ name: "a\u0000b", description: "" }, CODES)).toMatchObject({ ok: false, error: "nameInvalid" });
    expect(checkCode({ name: "motivacija", description: "" }, CODES)).toMatchObject({ ok: false, error: "nameTaken" });
    expect(checkCode({ name: "Nada", description: "x".repeat(501) }, CODES)).toMatchObject({ ok: false, field: "description", error: "descriptionTooLong" });
  });
  it("lets a code keep its own name when renamed, and refuses a 101st code", () => {
    expect(checkCode({ name: "Motivacija", description: "novi opis" }, CODES, "c1")).toMatchObject({ ok: true });
    const many = Array.from({ length: 100 }, (_, i) => code(`k${i}`, `Kod ${i}`, i));
    expect(checkCode({ name: "Novi", description: "" }, many)).toMatchObject({ ok: false, field: "form", error: "full" });
    expect(checkCode({ name: "Kod 0 novi", description: "" }, many, "k0")).toMatchObject({ ok: true });
  });
});

describe("checkMark", () => {
  it("cuts the quote from the text itself, so it agrees with the text", () => {
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 5, end: 15 }, "")).toEqual({ ok: true, anchor: { paragraph: 0, start: 5, end: 15, quote: "izmišljeni" } });
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 0, end: 4 }, " nap ")).toMatchObject({ ok: true, memo: "nap" });
  });
  it("refuses no code, no or odd selection, blank quote, long quote, bad memo and a line with astral characters", () => {
    expect(checkMark(LINES, "", { paragraph: 0, start: 0, end: 3 }, "")).toEqual({ ok: false, error: "noCode" });
    expect(checkMark(LINES, "c1", null, "")).toEqual({ ok: false, error: "noSelection" });
    expect(checkMark(LINES, "c1", { paragraph: 9, start: 0, end: 3 }, "")).toEqual({ ok: false, error: "noSelection" });
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 5, end: 5 }, "")).toEqual({ ok: false, error: "noSelection" });
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 0, end: 99 }, "")).toEqual({ ok: false, error: "noSelection" });
    expect(checkMark(["a   b"], "c1", { paragraph: 0, start: 1, end: 4 }, "")).toEqual({ ok: false, error: "noSelection" });
    expect(checkMark(["x".repeat(501)], "c1", { paragraph: 0, start: 0, end: 501 }, "")).toEqual({ ok: false, error: "quoteTooLong" });
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 0, end: 3 }, "m".repeat(1001))).toEqual({ ok: false, error: "memoTooLong" });
    expect(checkMark(LINES, "c1", { paragraph: 0, start: 0, end: 3 }, "a\u0001")).toEqual({ ok: false, error: "memoInvalid" });
    expect(checkMark(["Tekst 😀 emoji"], "c1", { paragraph: 0, start: 0, end: 5 }, "")).toEqual({ ok: false, error: "unsupportedText" });
  });
});

describe("wholeParagraph", () => {
  it("leaves the edge spaces out and refuses an empty line or a missing one", () => {
    expect(wholeParagraph(LINES, 2)).toEqual({ paragraph: 2, start: 2, end: 24 });
    expect(wholeParagraph(LINES, 1)).toBeNull();
    expect(wholeParagraph(LINES, 7)).toBeNull();
  });
});

describe("orderSegments", () => {
  const seg = (id: string, codeId: string, paragraph: number, start: number): Segment => ({ id, codeId, paragraph, start, end: start + 1, quote: "q", memo: null, createdOn: "2026-04-01" });
  it("orders by the codebook, then the text, never by how many; a gone code goes last", () => {
    const out = orderSegments([seg("a", "c2", 0, 0), seg("b", "c1", 2, 0), seg("c", "c1", 0, 5), seg("d", "gone", 0, 0), seg("e", "c1", 0, 1)], CODES);
    expect(out.map((s) => s.id)).toEqual(["e", "c", "b", "a", "d"]);
  });
});
