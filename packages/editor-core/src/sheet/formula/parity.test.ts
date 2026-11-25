import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeSheet,
  computeSheetDocument,
  createSheetDocument,
  validateSheetDocument,
  type Sheet,
  type SheetDocument,
} from "../index.ts";
import * as core from "../../index.ts";

// sha256 of server/domain/sheet/formula/formula-vectors.json on the server base
// (migracija/kopija-ductus-backend, SRV #743). The file must stay byte-for-byte equal.
const SERVER_VECTORS_SHA256 =
  "873aec8c310ea63010af0c0ccabb73fea6383b53f6cadb98306ea78ab9271df0";

describe("formula parity with the server", () => {
  it("formula-vectors.json is byte-identical to the server copy", () => {
    const bytes = readFileSync(new URL("./formula-vectors.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(SERVER_VECTORS_SHA256);
  });

  it("is exported from the package root through sheet/index.ts", () => {
    expect(core.computeSheet).toBe(computeSheet);
    expect(core.parseFormula).toBeTypeOf("function");
  });

  it("computes a document accepted by the web validator", () => {
    const base = createSheetDocument({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "List1" });
    const doc: SheetDocument = {
      ...base,
      sheets: [
        {
          ...base.sheets[0]!,
          rows: 3,
          columns: 2,
          cells: {
            A1: { value: 2 },
            A2: { value: 3 },
            B1: { value: null, formula: "=SUM(A1:A2)" },
            B2: { value: null, formula: "=A1/0" },
            B3: { value: null, formula: "=A3+B3" },
          },
        },
      ],
    };
    expect(validateSheetDocument(doc).ok).toBe(true);
    const out = computeSheetDocument(doc)[0]!.cells;
    expect(out.B1).toEqual({ type: "number", value: 5 });
    expect(out.B2).toEqual({ type: "error", code: "#DIV/0!" });
    expect(out.B3).toEqual({ type: "error", code: "#CIRC!" });
  });

  it("treats rows above 200 as a bad reference, not as a large range", () => {
    const sheet: Sheet = {
      id: "s",
      name: "List1",
      rows: 200,
      columns: 26,
      cells: { A1: { value: null, formula: "=SUM(A1:Z400)" }, B1: { value: null, formula: "=A201" } },
    };
    expect(computeSheet(sheet).B1).toEqual({ type: "error", code: "#REF!" });
    expect(computeSheet(sheet).A1).toEqual({ type: "error", code: "#REF!" });
  });

  it("reads a null cell value as empty text", () => {
    const sheet: Sheet = {
      id: "s",
      name: "List1",
      rows: 2,
      columns: 1,
      cells: { A1: { value: null }, A2: { value: null, formula: '=IF(A1="",1,0)' } },
    };
    expect(computeSheet(sheet).A2).toEqual({ type: "number", value: 1 });
  });
});
