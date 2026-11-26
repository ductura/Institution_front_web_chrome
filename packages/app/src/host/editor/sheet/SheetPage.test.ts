// WEB-V14-SHEET-PAGE: the bridge from the grid's whole documents to the steps of ductus-sheet-steps-v1.
import { describe, expect, it } from "vitest";

import { applySheetSteps, createSheetDocument, type SheetDocument } from "../../../../../editor-core/src/sheet/index.ts";
import { stepsBetween } from "./SheetPage";

const base = (): SheetDocument => ({
  ...createSheetDocument({ id: "s1", name: "List1" }),
  sheets: [{ id: "s1", name: "List1", rows: 4, columns: 3, cells: { A1: { value: 2 }, A2: { value: 3 }, A3: { value: null, formula: "=SUM(A1:A2)" } } }],
});
const edited = (f: (d: SheetDocument) => void) => { const d = structuredClone(base()); f(d); return d; };

describe("stepsBetween", () => {
  it("writes a changed, a new and a cleared cell as steps that replay to the new document", async () => {
    const after = edited((d) => { const c = d.sheets[0]!.cells; c.A1 = { value: 5 }; c.B1 = { value: "x" }; delete c.A2; });
    const steps = (await stepsBetween(base(), after))!;
    expect(steps.map((s) => s.type).sort()).toEqual(["cellClear", "cellSet", "cellSet"]);
    const replay = await applySheetSteps(base(), steps);
    expect(replay.ok && replay.doc).toEqual(after);
  });
  it("finds the row insert that moved cells, and a column removal", async () => {
    const inserted = edited((d) => {
      const s = d.sheets[0]!; s.rows = 5;
      s.cells = { A1: s.cells.A1!, A3: s.cells.A2!, A4: s.cells.A3! };
    });
    expect((await stepsBetween(base(), inserted))!.map((s) => s.type)).toEqual(["rowInsert"]);
    const narrower = edited((d) => { d.sheets[0]!.columns = 2; });
    expect((await stepsBetween(base(), narrower))!.map((s) => s.type)).toEqual(["columnRemove"]);
  });
  it("appends a row to a full sheet without hashing every candidate position", async () => {
    const full = structuredClone(base());
    full.sheets[0]!.rows = 100; full.sheets[0]!.columns = 10;
    for (let r = 1; r <= 100; r += 1) for (let c = 1; c <= 10; c += 1) full.sheets[0]!.cells[`${String.fromCharCode(64 + c)}${r}`] = { value: r * c };
    const after = structuredClone(full); after.sheets[0]!.rows = 101;
    const started = Date.now();
    expect((await stepsBetween(full, after))!).toEqual([{ type: "rowInsert", sheetId: "s1", row: 101 }]);
    expect(Date.now() - started).toBeLessThan(1500);
  });
  it("records a rename, and says nothing for an unchanged document", async () => {
    const renamed = edited((d) => { d.sheets[0]!.name = "Proračun"; });
    expect((await stepsBetween(base(), renamed))!.map((s) => s.type)).toEqual(["sheetRename"]);
    expect(await stepsBetween(base(), base())).toEqual([]);
  });
  it("refuses what the format cannot express (a new sheet, a jump of two rows) instead of guessing", async () => {
    const added = edited((d) => { d.sheets.push({ id: "s2", name: "List2", rows: 1, columns: 1, cells: {} }); });
    expect(await stepsBetween(base(), added)).toBeNull();
    expect(await stepsBetween(base(), edited((d) => { d.sheets[0]!.rows = 6; }))).toBeNull();
  });
});
