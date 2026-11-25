import { describe, expect, it } from "vitest";

import { byteLength, checkDraft, draftOf, emptyRow, isChanged, MAX_BYTES, MAX_TESTS, parseJson, studentView, type RowDraft } from "./model";

const row = (n: number, patch: Partial<RowDraft> = {}): RowDraft => ({ key: `k${n}`, id: null, title: `Zbroj ${n}`, input: "[1,2]", expected: "3", ...patch });
const many = (n: number) => Array.from({ length: n }, (_, i) => row(i));

describe("the code-test form model", () => {
  it("turns valid rows into a body with fresh ids and keeps the ids the server gave", () => {
    const checked = checkDraft([row(0, { id: "t1" }), row(1), row(2, { id: "zbroj_3" })]);
    expect(checked).toEqual({ ok: true, value: { language: "javascript", tests: [
      { id: "t1", title: "Zbroj 0", input: [1, 2], expected: 3 },
      { id: "t2", title: "Zbroj 1", input: [1, 2], expected: 3 },
      { id: "zbroj_3", title: "Zbroj 2", input: [1, 2], expected: 3 },
    ] } });
  });
  it("accepts no tests (the empty list is a valid revision)", () => {
    expect(checkDraft([])).toEqual({ ok: true, value: { language: "javascript", tests: [] } });
  });
  it("refuses an invalid JSON input, an empty one and an invalid expected output, naming the row and field", () => {
    expect(checkDraft([row(0), row(1, { input: "{nope" })])).toEqual({ ok: false, error: { kind: "row", index: 1, field: "input" } });
    expect(checkDraft([row(0, { input: "  " })])).toEqual({ ok: false, error: { kind: "row", index: 0, field: "input" } });
    expect(checkDraft([row(0, { expected: "[1," })])).toEqual({ ok: false, error: { kind: "row", index: 0, field: "expected" } });
  });
  it("refuses an empty, blank or too long title", () => {
    expect(checkDraft([row(0, { title: "   " })])).toMatchObject({ ok: false, error: { field: "title" } });
    expect(checkDraft([row(0, { title: "x".repeat(121) })])).toMatchObject({ ok: false, error: { field: "title" } });
    expect(checkDraft([row(0, { title: "x".repeat(120) })]).ok).toBe(true);
  });
  it("allows 10 tests and refuses the 11th", () => {
    expect(checkDraft(many(MAX_TESTS)).ok).toBe(true);
    expect(checkDraft(many(MAX_TESTS + 1))).toEqual({ ok: false, error: { kind: "count" } });
  });
  it("refuses a body over 16 KiB, measured in bytes of the JSON that would be sent", () => {
    const big = JSON.stringify("č".repeat(MAX_BYTES / 4));
    const checked = checkDraft([row(0, { input: big }), row(1, { input: big })]);
    expect(checked).toEqual({ ok: false, error: { kind: "size" } });
    expect(byteLength({ language: "javascript", tests: [{ id: "t1", title: "a", input: "č", expected: 1 }] })).toBe(new TextEncoder().encode(JSON.stringify({ language: "javascript", tests: [{ id: "t1", title: "a", input: "č", expected: 1 }] })).length);
  });
  it("parseJson never turns empty or broken text into null", () => {
    expect(parseJson("null")).toEqual({ ok: true, value: null });
    expect(parseJson("")).toEqual({ ok: false });
    expect(parseJson("undefined")).toEqual({ ok: false });
  });
  it("reads a saved revision back as text and sees no change until a row is edited", () => {
    const view = { revisionNo: 3, language: "javascript" as const, tests: [{ id: "t1", title: "A", input: { a: 1 }, expected: [2] }] };
    const rows = draftOf(view);
    expect(rows[0]).toMatchObject({ id: "t1", input: '{"a":1}', expected: "[2]" });
    expect(isChanged(rows, view)).toBe(false);
    expect(isChanged([{ ...rows[0]!, title: "B" }], view)).toBe(true);
    expect(isChanged([], view)).toBe(true);
    expect(isChanged([], null)).toBe(false);
    expect(isChanged([emptyRow([])], null)).toBe(true);
  });
  it("shows the student only the rows that would be saved", () => {
    expect(studentView([row(0), row(1, { input: "{" }), row(2, { title: "" })])).toEqual([{ title: "Zbroj 0", input: "[1,2]", expected: "3" }]);
  });
});
