import { describe, expect, it } from "vitest";

import { canonicalSheetDocument, createSheetDocument, type SheetDocument } from "../../../../../../editor-core/src/sheet/index.ts";
import { sheetsWord, summarizeSheet, summaryOfDocument } from "./model.ts";

const doc = (): SheetDocument => {
  const d = createSheetDocument({ id: "s1", name: "List1" });
  d.sheets[0]!.rows = 3; d.sheets[0]!.columns = 3;
  d.sheets[0]!.cells = { A1: { value: 2 }, A2: { value: 3 }, A3: { value: null, formula: "=SUM(A1:A2)" }, B1: { value: "x" } };
  return d;
};
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe("sheet summary", () => {
  it("counts sheets, filled cells and formulas", () => {
    expect(summarizeSheet(doc())).toEqual({ sheets: 1, filledCells: 4, formulas: 1 });
  });
  it("reads only the exact canonical bytes of a valid sheet", () => {
    expect(summaryOfDocument(b64(canonicalSheetDocument(doc())))).toEqual({ sheets: 1, filledCells: 4, formulas: 1 });
    expect(summaryOfDocument(b64(JSON.stringify(doc(), null, 2)))).toBeNull(); // not canonical
    expect(summaryOfDocument(b64('{"kind":"text"}'))).toBeNull();
    expect(summaryOfDocument("%%%not-base64")).toBeNull();
    expect(summaryOfDocument("")).toBeNull();
  });
  it("uses Croatian plural forms", () => {
    const w = { one: "a", few: "b", many: "c" };
    expect([0, 1, 2, 4, 5, 11].map((n) => sheetsWord(n, w))).toEqual(["c", "a", "b", "b", "c", "c"]);
  });
});
