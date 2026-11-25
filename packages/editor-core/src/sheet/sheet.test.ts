import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import vectors from "./golden-vectors.json";
import {
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  addColumn,
  addRow,
  canonicalSheetDocument,
  countFilledCells,
  createSheetDocument,
  deleteColumn,
  deleteRow,
  formatCellRef,
  parseCellRef,
  sheetDocumentsEqual,
  validateSheetDocument,
  type SheetDocument,
} from "./index.ts";
import * as core from "../index.ts";

type Vector = {
  name: string;
  valid: boolean;
  input: unknown;
  canonical?: string;
  sha256?: string;
  code?: string;
};

describe("golden vectors", () => {
  for (const v of vectors.vectors as Vector[]) {
    it(v.name, () => {
      const result = validateSheetDocument(v.input);
      if (v.valid) {
        expect(result.ok).toBe(true);
        const text = canonicalSheetDocument(v.input as SheetDocument);
        expect(text).toBe(v.canonical);
        expect(createHash("sha256").update(text, "utf8").digest("hex")).toBe(v.sha256);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe(v.code);
      }
    });
  }

  it("covers every validation code at least once", () => {
    const codes = new Set((vectors.vectors as Vector[]).filter((v) => !v.valid).map((v) => v.code));
    expect(codes.size).toBeGreaterThanOrEqual(18);
  });
});

describe("cell count bound (built in code, too large for the vectors file)", () => {
  const big = (extra: number): SheetDocument => {
    const sheets = [1, 2, 3].map((i) => {
      const cells: Record<string, { value: number }> = {};
      for (let n = 0; n < 1000; n += 1) {
        cells[formatCellRef({ row: Math.floor(n / 26) + 1, column: (n % 26) + 1 })] = { value: n };
      }
      return { id: `s${i}`, name: `L${i}`, rows: 200, columns: 26, cells };
    });
    if (extra > 0) sheets[2]!.cells.Z200 = { value: 1 };
    return { schemaVersion: 1, kind: "spreadsheet", sheets };
  };
  it("accepts exactly 3000 filled cells", () => {
    expect(validateSheetDocument(big(0)).ok).toBe(true);
    expect(countFilledCells(big(0))).toBe(3000);
  });
  it("rejects 3001", () => {
    const r = validateSheetDocument(big(1));
    expect(r.ok === false && r.code).toBe("too_many_cells");
  });
});

describe("lone surrogates (not representable in the JSON vectors file)", () => {
  it("are rejected in cell text and formulas", () => {
    const d = createSheetDocument();
    d.sheets[0]!.cells = { A1: { value: "\ud800" } };
    const r1 = validateSheetDocument(d);
    expect(r1.ok === false && r1.code).toBe("bad_cell_value");
    d.sheets[0]!.cells = { A1: { value: null, formula: "=\udc00" } };
    const r2 = validateSheetDocument(d);
    expect(r2.ok === false && r2.code).toBe("bad_formula");
  });
});

describe("model helpers", () => {
  it("parses and formats cell references both ways", () => {
    expect(parseCellRef("B3")).toEqual({ row: 3, column: 2 });
    expect(parseCellRef("Z200")).toEqual({ row: 200, column: 26 });
    for (const bad of ["", "a1", "A0", "AA1", "1A", "A01", "A1 "]) {
      expect(parseCellRef(bad)).toBeNull();
    }
    expect(formatCellRef({ row: 3, column: 2 })).toBe("B3");
    expect(() => formatCellRef({ row: 1, column: 27 })).toThrow(RangeError);
  });

  it("counts filled cells over all sheets and equality ignores key order", () => {
    const a = createSheetDocument();
    a.sheets[0]!.cells = { A1: { value: 1 }, B1: { value: "x" } };
    const b = JSON.parse(JSON.stringify(a)) as SheetDocument;
    b.sheets[0]!.cells = { B1: { value: "x" }, A1: { value: 1 } };
    expect(countFilledCells(a)).toBe(2);
    expect(sheetDocumentsEqual(a, b)).toBe(true);
    b.sheets[0]!.cells.A1 = { value: 2 };
    expect(sheetDocumentsEqual(a, b)).toBe(false);
  });

  it("is exported from the package entry point", () => {
    expect(core.validateSheetDocument).toBe(validateSheetDocument);
    expect(core.addRow).toBe(addRow);
  });
});

function sample(): SheetDocument {
  const doc = createSheetDocument({ id: "s1", name: "Demo" });
  doc.sheets[0] = {
    ...doc.sheets[0]!,
    rows: 3,
    columns: 3,
    cells: {
      A1: { value: "a" },
      B2: { value: 2 },
      C3: { value: null, formula: "=B2*2" },
    },
  };
  return doc;
}

describe("ops", () => {
  it("addRow shifts rows below and keeps the result valid", () => {
    const before = sample();
    const snapshot = JSON.stringify(before);
    const r = addRow(before, "s1", 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.doc.sheets[0]!.cells).sort()).toEqual(["A1", "B3", "C4"]);
    expect(r.doc.sheets[0]!.rows).toBe(4);
    expect(validateSheetDocument(r.doc).ok).toBe(true);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("deleteRow drops the row's cells and shifts the rest", () => {
    const r = deleteRow(sample(), "s1", 2);
    expect(r.ok && Object.keys(r.doc.sheets[0]!.cells).sort()).toEqual(["A1", "C2"]);
    expect(r.ok && r.doc.sheets[0]!.rows).toBe(2);
  });

  it("addColumn and deleteColumn move cells by column", () => {
    const added = addColumn(sample(), "s1", 1);
    expect(added.ok && Object.keys(added.doc.sheets[0]!.cells).sort()).toEqual(["B1", "C2", "D3"]);
    const deleted = deleteColumn(sample(), "s1", 2);
    expect(deleted.ok && Object.keys(deleted.doc.sheets[0]!.cells).sort()).toEqual(["A1", "B3"]);
    expect(deleted.ok && validateSheetDocument(deleted.doc).ok).toBe(true);
  });

  it("appending at rows+1 / columns+1 is allowed, beyond it is not", () => {
    expect(addRow(sample(), "s1", 4).ok).toBe(true);
    expect(addRow(sample(), "s1", 5)).toEqual({ ok: false, error: "index_out_of_range" });
    expect(addColumn(sample(), "s1", 4).ok).toBe(true);
    expect(addColumn(sample(), "s1", 0)).toEqual({ ok: false, error: "index_out_of_range" });
    expect(deleteRow(sample(), "s1", 4)).toEqual({ ok: false, error: "index_out_of_range" });
    expect(deleteRow(sample(), "s1", 1.5)).toEqual({ ok: false, error: "index_out_of_range" });
  });

  it("refuses to exceed the limits and to delete the last row/column", () => {
    const full = sample();
    full.sheets[0] = { ...full.sheets[0]!, rows: MAX_SHEET_ROWS, columns: MAX_SHEET_COLUMNS, cells: {} };
    expect(addRow(full, "s1", 1)).toEqual({ ok: false, error: "limit_reached" });
    expect(addColumn(full, "s1", 1)).toEqual({ ok: false, error: "limit_reached" });
    const one = createSheetDocument({ id: "s1", name: "Demo" });
    expect(deleteRow(one, "s1", 1)).toEqual({ ok: false, error: "last_line" });
    expect(deleteColumn(one, "s1", 1)).toEqual({ ok: false, error: "last_line" });
  });

  it("an unknown sheet id is not found, whatever the index", () => {
    expect(addRow(sample(), "other", 1)).toEqual({ ok: false, error: "sheet_not_found" });
    expect(deleteColumn(sample(), "other", 1)).toEqual({ ok: false, error: "sheet_not_found" });
  });

  it("row add followed by delete restores the document", () => {
    const start = sample();
    const added = addRow(start, "s1", 2);
    const back = added.ok ? deleteRow(added.doc, "s1", 2) : added;
    expect(back.ok && sheetDocumentsEqual(back.doc, start)).toBe(true);
  });
});
