// WEB-V14-SHEET-GRID: the pure model of the grid. Every sheet, text and number is invented.
import { describe, expect, it } from "vitest";

import { computeSheet, createSheetDocument, validateSheetDocument, type SheetDocument } from "../../../../../editor-core/src/sheet/index.ts";
import {
  addSheet, cellInputText, clampSelection, clearRange, displayCell, emptyHistory, MAX_HISTORY, moveSelection, parseCellInput, rangeName, rangeOf,
  recordEdit, redo, setCellText, startSelection, stepAfterCommit, undo,
} from "./grid-model";

const doc = (rows = 5, columns = 4): SheetDocument => {
  const d = createSheetDocument({ id: "s1", name: "Proračun" });
  return { ...d, sheets: [{ ...d.sheets[0]!, rows, columns }] };
};
const ok = (r: ReturnType<typeof setCellText>): SheetDocument => {
  if (!r.ok) throw new Error(`refused: ${r.error}`);
  return r.doc;
};

describe("parseCellInput", () => {
  it("reads numbers with a decimal comma or point, text, formulas and nothing", () => {
    expect(parseCellInput("12,5")).toEqual({ kind: "cell", cell: { value: 12.5 } });
    expect(parseCellInput("-3.25")).toEqual({ kind: "cell", cell: { value: -3.25 } });
    expect(parseCellInput("Ukupno")).toEqual({ kind: "cell", cell: { value: "Ukupno" } });
    expect(parseCellInput("=SUM(A1:A3)")).toEqual({ kind: "cell", cell: { value: null, formula: "=SUM(A1:A3)" } });
    expect(parseCellInput("")).toEqual({ kind: "clear" });
  });
  it("refuses a bare =, a formula over 500 and a text over 1000 characters", () => {
    expect(parseCellInput("=")).toEqual({ kind: "refused", error: "formula_empty" });
    expect(parseCellInput(`=${"1+".repeat(300)}1`)).toEqual({ kind: "refused", error: "formula_too_long" });
    expect(parseCellInput("x".repeat(1001))).toEqual({ kind: "refused", error: "cell_too_long" });
    expect(parseCellInput("x".repeat(1000)).kind).toBe("cell");
  });
});

describe("setCellText", () => {
  it("stores a formula without a result and keeps the input document unchanged", () => {
    const before = doc();
    const frozen = JSON.stringify(before);
    const next = ok(setCellText(before, "s1", "A1", "=1+2"));
    expect(next.sheets[0]!.cells.A1).toEqual({ value: null, formula: "=1+2" });
    expect(JSON.stringify(before)).toBe(frozen);
    expect(validateSheetDocument(next).ok).toBe(true);
  });
  it("clears a cell by an empty text and does nothing to an empty one", () => {
    const filled = ok(setCellText(doc(), "s1", "B2", "7"));
    expect(ok(setCellText(filled, "s1", "B2", "")).sheets[0]!.cells).toEqual({});
    expect(ok(setCellText(doc(), "s1", "B2", "")).sheets[0]!.cells).toEqual({});
  });
  it("treats another sheet and a cell outside the sheet as not there", () => {
    expect(setCellText(doc(), "tuđi-list", "A1", "1")).toEqual({ ok: false, error: "sheet_not_found" });
    expect(setCellText(doc(5, 4), "s1", "E1", "1")).toEqual({ ok: false, error: "out_of_range" });
    expect(setCellText(doc(5, 4), "s1", "A6", "1")).toEqual({ ok: false, error: "out_of_range" });
    expect(setCellText(doc(), "s1", "a1", "1")).toEqual({ ok: false, error: "out_of_range" });
  });
  it("refuses the 3001st filled cell but still lets a filled one change", () => {
    let d = doc(200, 26);
    const cells: SheetDocument["sheets"][0]["cells"] = {};
    let n = 0;
    for (let r = 1; r <= 200 && n < 3000; r += 1) for (let c = 0; c < 26 && n < 3000; c += 1, n += 1) cells[`${String.fromCharCode(65 + c)}${r}`] = { value: n };
    d = { ...d, sheets: [{ ...d.sheets[0]!, cells }] };
    const full = d.sheets[0]!.cells;
    const lastFree = Object.keys(full).includes("Z200") ? "Y200" : "Z200";
    expect(setCellText(d, "s1", lastFree, "1")).toEqual({ ok: false, error: "too_many_cells" });
    expect(setCellText(d, "s1", "A1", "99").ok).toBe(true);
  });
});

describe("clearRange and addSheet", () => {
  it("clears a whole range in one step", () => {
    let d = doc();
    for (const [ref, v] of [["A1", "1"], ["B1", "2"], ["B2", "3"], ["C3", "4"]] as const) d = ok(setCellText(d, "s1", ref, v));
    const r = clearRange(d, "s1", rangeOf({ active: { row: 1, column: 1 }, focus: { row: 2, column: 2 } }));
    expect(Object.keys(ok(r).sheets[0]!.cells)).toEqual(["C3"]);
  });
  it("adds at most five sheets, with a free name and id", () => {
    let d = doc();
    const ids = ["s1", "s1", "a", "a", "b", "c", "d"]; // the first answers collide with a taken id
    let n = 0;
    for (let i = 0; i < 4; i += 1) d = ok(addSheet(d, () => ids[n++]!));
    expect(d.sheets.map((s) => s.name)).toEqual(["Proračun", "List2", "List3", "List4", "List5"]);
    expect(new Set(d.sheets.map((s) => s.id)).size).toBe(5);
    expect(addSheet(d, () => "x")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("what a cell shows", () => {
  it("shows the computed result, an error code, and never a stored result", () => {
    let d = doc();
    d = ok(setCellText(d, "s1", "A1", "10"));
    d = ok(setCellText(d, "s1", "A2", "0"));
    d = ok(setCellText(d, "s1", "B1", "=A1/A2"));
    d = ok(setCellText(d, "s1", "B2", "=A1/4"));
    const sheet = d.sheets[0]!;
    const computed = computeSheet(sheet);
    expect(displayCell(sheet.cells.B1, computed.B1)).toEqual({ text: "#DIV/0!", error: "#DIV/0!" });
    expect(displayCell(sheet.cells.B2, computed.B2)).toEqual({ text: "2,5", error: null });
    expect(sheet.cells.B2!.value).toBeNull();
    expect(cellInputText(sheet.cells.B2)).toBe("=A1/4");
    expect(cellInputText(sheet.cells.A1)).toBe("10");
    expect(displayCell(undefined, undefined)).toEqual({ text: "", error: null });
  });
});

describe("selection", () => {
  const s = { rows: 5, columns: 4 };
  it("moves by arrows, stops at the edges and extends with Shift", () => {
    const a = startSelection();
    expect(moveSelection(a, "ArrowUp", { shift: false, ctrl: false }, s)).toEqual(a);
    const down = moveSelection(a, "ArrowDown", { shift: false, ctrl: false }, s);
    expect(down.active).toEqual({ row: 2, column: 1 });
    const ext = moveSelection(down, "ArrowRight", { shift: true, ctrl: false }, s);
    expect(ext.active).toEqual({ row: 2, column: 1 });
    expect(rangeName(rangeOf(moveSelection(ext, "ArrowDown", { shift: true, ctrl: false }, s)))).toBe("A2:B3");
  });
  it("goes to the ends with Home/End and Ctrl", () => {
    const end = moveSelection(startSelection(), "End", { shift: false, ctrl: true }, s);
    expect(end.active).toEqual({ row: 5, column: 4 });
    expect(moveSelection(end, "Home", { shift: false, ctrl: false }, s).active).toEqual({ row: 5, column: 1 });
    expect(moveSelection(end, "Home", { shift: false, ctrl: true }, s).active).toEqual({ row: 1, column: 1 });
  });
  it("steps after a commit: Enter down, Tab right, Shift reverses, edges hold", () => {
    const a = startSelection();
    expect(stepAfterCommit(a, "Enter", false, s).active).toEqual({ row: 2, column: 1 });
    expect(stepAfterCommit(a, "Tab", false, s).active).toEqual({ row: 1, column: 2 });
    expect(stepAfterCommit(a, "Tab", true, s).active).toEqual({ row: 1, column: 1 });
  });
  it("keeps a selection inside a smaller sheet", () => {
    const sel = { active: { row: 9, column: 9 }, focus: { row: 9, column: 9 } };
    expect(clampSelection(sel, s).active).toEqual({ row: 5, column: 4 });
  });
});

describe("history", () => {
  const a = doc();
  const b = ok(setCellText(a, "s1", "A1", "1"));
  const c = ok(setCellText(b, "s1", "A1", "2"));
  it("undoes and redoes in order, and a new edit drops the redo line", () => {
    let h = recordEdit(recordEdit(emptyHistory(), a), b);
    const u1 = undo(h, c)!;
    expect(u1.doc).toBe(b);
    const u2 = undo(u1.history, u1.doc)!;
    expect(u2.doc).toBe(a);
    expect(undo(u2.history, u2.doc)).toBeNull();
    const r1 = redo(u2.history, u2.doc)!;
    expect(r1.doc).toBe(b);
    h = recordEdit(r1.history, r1.doc);
    expect(redo(h, c)).toBeNull();
  });
  it("keeps at most MAX_HISTORY steps", () => {
    let h = emptyHistory();
    for (let i = 0; i < MAX_HISTORY + 20; i += 1) h = recordEdit(h, a);
    expect(h.past).toHaveLength(MAX_HISTORY);
  });
});
