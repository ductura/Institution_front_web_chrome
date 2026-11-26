/**
 * SheetDocument v1: the document model of a spreadsheet work (documentKind
 * "spreadsheet", docs/nalazi/val14-razlika.md decision 2). Pure data and pure
 * helpers, no UI and no formulas. The server keeps the same model; both sides
 * share golden-vectors.json.
 */
import { canonicalizeJcs } from "../document/forensics/jcs.ts";

export const SHEET_SCHEMA_VERSION = 1;
export const MAX_SHEETS = 5;
export const MAX_SHEET_NAME_LENGTH = 31;
export const MAX_SHEET_ROWS = 200;
export const MAX_SHEET_COLUMNS = 26;
/** Same bound as MAX_TABLE_CELLS for a table block in a text work. */
export const MAX_SHEET_FILLED_CELLS = 3000;
export const MAX_FORMULA_LENGTH = 500;
/** Assumption (not in the decision): longest text a cell may hold. */
export const MAX_CELL_TEXT_LENGTH = 1000;
export const MAX_SHEET_ID_LENGTH = 64;

export type SheetCellValue = string | number | null;

/**
 * A filled cell. `value` is text, a number or null. A cell with neither a
 * non-empty value nor a formula is not stored: empty cells are absent, which
 * keeps the canonical form unique. A formula's result is never stored as the
 * truth (decision 4), so a formula cell normally has `value: null`.
 */
export interface SheetCell {
  value: SheetCellValue;
  formula?: string;
}

export interface Sheet {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: Record<string, SheetCell>;
}

export interface SheetDocument {
  schemaVersion: typeof SHEET_SCHEMA_VERSION;
  kind: "spreadsheet";
  sheets: Sheet[];
}

const CELL_REF = /^([A-Z])([1-9][0-9]*)$/;

export interface CellPosition {
  /** 1-based row. */
  row: number;
  /** 1-based column (A = 1). */
  column: number;
}

/** "B3" -> {row: 3, column: 2}; null when not a well-formed A1 reference. */
export function parseCellRef(ref: string): CellPosition | null {
  const match = CELL_REF.exec(ref);
  if (match === null) return null;
  const row = Number(match[2]);
  if (!Number.isSafeInteger(row)) return null;
  return { row, column: match[1]!.charCodeAt(0) - 64 };
}

/** {row: 3, column: 2} -> "B3". Column must be 1..26, row at least 1. */
export function formatCellRef(position: CellPosition): string {
  const { row, column } = position;
  if (!Number.isInteger(column) || column < 1 || column > MAX_SHEET_COLUMNS) {
    throw new RangeError(`sheet: column ${column} out of range`);
  }
  if (!Number.isInteger(row) || row < 1) {
    throw new RangeError(`sheet: row ${row} out of range`);
  }
  return `${String.fromCharCode(64 + column)}${row}`;
}

/** True when the cell holds something (non-empty value or a formula). */
export function isFilledCell(cell: SheetCell): boolean {
  return (
    cell.formula !== undefined ||
    (cell.value !== null && cell.value !== "")
  );
}

/** Number of filled cells over all sheets. */
export function countFilledCells(doc: SheetDocument): number {
  let total = 0;
  for (const sheet of doc.sheets) {
    for (const cell of Object.values(sheet.cells)) {
      if (isFilledCell(cell)) total += 1;
    }
  }
  return total;
}

/** A new document with one empty sheet. */
export function createSheetDocument(
  firstSheet: { id: string; name: string } = { id: "sheet-1", name: "List1" },
): SheetDocument {
  return {
    schemaVersion: SHEET_SCHEMA_VERSION,
    kind: "spreadsheet",
    sheets: [
      {
        id: firstSheet.id,
        name: firstSheet.name,
        rows: 1,
        columns: 1,
        cells: {},
      },
    ],
  };
}

/** Canonical (RFC 8785) text of a document: the input of its digest. */
export function canonicalSheetDocument(doc: SheetDocument): string {
  return canonicalizeJcs(doc);
}

/** Equality by canonical form, so key order never matters. */
export function sheetDocumentsEqual(
  a: SheetDocument,
  b: SheetDocument,
): boolean {
  return canonicalSheetDocument(a) === canonicalSheetDocument(b);
}
