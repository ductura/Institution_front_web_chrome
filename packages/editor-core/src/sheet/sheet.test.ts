import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ID_LENGTH,
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

// Golden vectors (SRV-V14-SHEET-MODEL, val 14 decision 2). golden-vectors.json is a byte-for-byte
// copy of server/domain/sheet/golden-vectors.json in the server repository (ductura/Institution_server).
// It is derived outside any repository code; never regenerate it from this code, copy it again.
// The server reports every error of a rejected document as [path, SHEET_*/CELL_* code]; this
// validator returns the first problem with its own code, so only the first path and the mapped code
// are compared.
type Accepted = { name: string; value: unknown; utf8Hex: string; sha256: string };
type Rejected = { name: string; value: unknown; errors: [string, string][] };

const VECTOR_BYTES = readFileSync(new URL("./golden-vectors.json", import.meta.url));
const VECTORS = JSON.parse(VECTOR_BYTES.toString("latin1")) as {
  sheetDocuments: Accepted[];
  rejectedSheetDocuments: Rejected[];
};

/** Server error code -> codes this validator may report for the same fault. */
const CODE_MAP: Record<string, string[]> = {
  SHEET_NOT_OBJECT: ["not_object"],
  SHEET_FIELD_UNKNOWN: ["unknown_field"],
  SHEET_VERSION_INVALID: ["bad_schema_version"],
  SHEET_KIND_INVALID: ["bad_kind"],
  SHEET_LIST_INVALID: ["bad_sheets", "too_many_sheets"],
  SHEET_ID_INVALID: ["bad_sheet_id"],
  SHEET_ID_DUPLICATE: ["duplicate_sheet_id"],
  SHEET_NAME_INVALID: ["bad_sheet_name"],
  SHEET_NAME_DUPLICATE: ["duplicate_sheet_name"],
  SHEET_ROWS_INVALID: ["bad_dimension"],
  SHEET_COLUMNS_INVALID: ["bad_dimension"],
  SHEET_CELLS_INVALID: ["bad_cell"],
  CELL_REF_INVALID: ["bad_cell_ref", "cell_out_of_bounds"],
  CELL_OUT_OF_GRID: ["cell_out_of_bounds"],
  CELL_NOT_OBJECT: ["bad_cell"],
  CELL_EMPTY: ["empty_cell_stored"],
  CELL_FIELD_UNKNOWN: ["unknown_field"],
  CELL_VALUE_INVALID: ["bad_cell_value", "missing_field", "empty_cell_stored"],
  CELL_FORMULA_INVALID: ["bad_formula"],
};

/**
 * Documents the server refuses and this validator still accepts (found by this parity test).
 * Closing them changes validate.ts, outside this task's paths; they are tracked in the PR as open.
 * `it.fails` keeps them honest: when validate.ts is fixed these cases turn red and must be moved
 * into the normal list.
 */
const WEB_ACCEPTS_BUT_SERVER_REFUSES = new Set([
  "uppercase-sheet-id",
  "cell-text-with-nul",
  "cell-text-with-zero-width-space",
  "formula-with-line-break",
  "formula-with-stored-result",
]);

describe("golden vectors: file parity with the server", () => {
  it("is the server file: ASCII, LF only, the agreed vectors and no web-only fields", () => {
    expect(VECTOR_BYTES.some((byte) => byte > 0x7e || byte === 0x0d)).toBe(false);
    expect(Object.keys(JSON.parse(VECTOR_BYTES.toString("latin1"))).sort()).toEqual([
      "about",
      "rejectedSheetDocuments",
      "sheetDocuments",
      "vectorSchema",
    ]);
    expect(VECTORS.sheetDocuments).toHaveLength(4);
    expect(VECTORS.rejectedSheetDocuments).toHaveLength(41);
  });
  it("every server error code has a mapping here", () => {
    const seen = new Set(VECTORS.rejectedSheetDocuments.flatMap((v) => v.errors.map((e) => e[1])));
    expect([...seen].filter((c) => !(c in CODE_MAP))).toEqual([]);
  });
});

describe("golden vectors: accepted documents", () => {
  it.each(VECTORS.sheetDocuments)("$name has the same bytes and hash as the server", (v) => {
    const bytes = Buffer.from(v.utf8Hex, "hex");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(v.sha256);
    expect(validateSheetDocument(v.value).ok).toBe(true);
    const text = canonicalSheetDocument(v.value as SheetDocument);
    expect(Buffer.from(text, "utf8").toString("hex")).toBe(v.utf8Hex);
    expect(createHash("sha256").update(text, "utf8").digest("hex")).toBe(v.sha256);
    const reparsed = JSON.parse(bytes.toString("utf8")) as SheetDocument;
    expect(validateSheetDocument(reparsed).ok).toBe(true);
    expect(sheetDocumentsEqual(v.value as SheetDocument, reparsed)).toBe(true);
  });
});

describe("golden vectors: rejected documents", () => {
  const refused = VECTORS.rejectedSheetDocuments.filter((v) => !WEB_ACCEPTS_BUT_SERVER_REFUSES.has(v.name));
  const gaps = VECTORS.rejectedSheetDocuments.filter((v) => WEB_ACCEPTS_BUT_SERVER_REFUSES.has(v.name));

  it.each(refused)("$name is refused with the code and place the server reports", (v) => {
    const r = validateSheetDocument(v.value);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const [firstPath, firstCode] = v.errors[0]!;
    expect(CODE_MAP[firstCode]).toContain(r.code);
    // A cell fault is reported on the cell or on one of its fields; everything else on the same path.
    expect(r.path.startsWith(firstPath.split(".").slice(0, 4).join(".")), r.path).toBe(true);
  });

  it.fails.each(gaps)("$name: still accepted here although the server refuses it (open gap)", (v) => {
    expect(validateSheetDocument(v.value).ok).toBe(false);
  });

  it("the open-gap list names only vectors that exist", () => {
    const names = new Set(VECTORS.rejectedSheetDocuments.map((v) => v.name));
    expect([...WEB_ACCEPTS_BUT_SERVER_REFUSES].filter((n) => !names.has(n))).toEqual([]);
  });

  it("covers every validation code but too_many_cells (built in code below) and bad_sheet_id (below)", () => {
    const all = [
      "bad_cell", "bad_cell_ref", "bad_cell_value", "bad_dimension", "bad_formula",
      "bad_kind", "bad_schema_version", "bad_sheet_name", "bad_sheets",
      "cell_out_of_bounds", "duplicate_sheet_id", "duplicate_sheet_name", "empty_cell_stored",
      "missing_field", "not_object", "too_many_sheets", "unknown_field",
    ];
    const seen = new Set(
      refused.map((v) => {
        const r = validateSheetDocument(v.value);
        return r.ok ? "" : r.code;
      }),
    );
    expect([...seen].sort()).toEqual(all);
  });
});

describe("validation codes the server vectors do not reach", () => {
  it("rejects an empty sheet id and an id longer than the limit", () => {
    for (const id of ["", "a".repeat(MAX_SHEET_ID_LENGTH + 1)]) {
      const r = validateSheetDocument(createSheetDocument({ id, name: "List1" }));
      expect(r.ok === false && r.code, id.length.toString()).toBe("bad_sheet_id");
    }
  });
  it("rejects a root array, a zero row count and a missing sheets field", () => {
    const a = validateSheetDocument([]);
    expect(a.ok === false && a.code).toBe("not_object");
    const d = createSheetDocument();
    d.sheets[0] = { ...d.sheets[0]!, rows: 0 };
    const b = validateSheetDocument(d);
    expect(b.ok === false && b.code).toBe("bad_dimension");
    const c = validateSheetDocument({ schemaVersion: 1, kind: "spreadsheet" });
    expect(c.ok === false && c.code).toBe("missing_field");
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

describe("length limits count code points and arrays have no holes", () => {
  it("accepts 1000 emoji in a cell but not 1001", () => {
    const d = createSheetDocument();
    d.sheets[0]!.cells = { A1: { value: "😀".repeat(1000) } };
    expect(validateSheetDocument(d).ok).toBe(true);
    d.sheets[0]!.cells = { A1: { value: "😀".repeat(1001) } };
    const r = validateSheetDocument(d);
    expect(r.ok === false && r.code).toBe("bad_cell_value");
  });
  it("counts a sheet name in UTF-16 units, as .xlsx does", () => {
    const ok = createSheetDocument({ id: "s1", name: "😀".repeat(15) });
    expect(validateSheetDocument(ok).ok).toBe(true);
    for (const n of [16, 31]) {
      const r = validateSheetDocument(createSheetDocument({ id: "s1", name: "😀".repeat(n) }));
      expect(r.ok === false && r.code).toBe("bad_sheet_name");
    }
  });
  it("rejects sheet names .xlsx cannot hold", () => {
    for (const name of ["a/b", "a\\b", "a?", "a*", "[a]", "a:b", "'a", "a'"]) {
      const r = validateSheetDocument(createSheetDocument({ id: "s1", name }));
      expect(r.ok === false && r.code, name).toBe("bad_sheet_name");
    }
    expect(validateSheetDocument(createSheetDocument({ id: "s1", name: "Ana's" })).ok).toBe(true);
  });
  it("rejects a sparse sheets array", () => {
    const r = validateSheetDocument({ schemaVersion: 1, kind: "spreadsheet", sheets: new Array(1) });
    expect(r.ok === false && r.code).toBe("bad_sheets");
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
