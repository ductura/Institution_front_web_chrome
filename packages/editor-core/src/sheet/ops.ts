/**
 * Structural operations on a SheetDocument: add/delete a row or column. Pure
 * and immutable: every operation returns a new document or a typed refusal,
 * never mutates its input. Cells move with their row/column. Formulas are not
 * rewritten here (the formula evaluator is a separate task), so a formula that
 * refers to a moved cell keeps its text.
 */
import {
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  formatCellRef,
  parseCellRef,
  type Sheet,
  type SheetCell,
  type SheetDocument,
} from "./model.ts";

export type SheetOpError =
  | "sheet_not_found"
  | "index_out_of_range"
  | "limit_reached"
  | "last_line";

export type SheetOpResult =
  | { ok: true; doc: SheetDocument }
  | { ok: false; error: SheetOpError };

type Axis = "row" | "column";

function withSheet(
  doc: SheetDocument,
  sheetId: string,
  change: (sheet: Sheet) => Sheet | SheetOpError,
): SheetOpResult {
  const index = doc.sheets.findIndex((s) => s.id === sheetId);
  if (index < 0) return { ok: false, error: "sheet_not_found" };
  const next = change(doc.sheets[index]!);
  if (typeof next === "string") return { ok: false, error: next };
  const sheets = doc.sheets.slice();
  sheets[index] = next;
  return { ok: true, doc: { ...doc, sheets } };
}

function shift(sheet: Sheet, axis: Axis, at: number, delta: 1 | -1): Record<string, SheetCell> {
  const cells: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    const pos = parseCellRef(ref)!;
    const line = axis === "row" ? pos.row : pos.column;
    if (delta === -1 && line === at) continue;
    const moved = line >= at ? line + delta : line;
    const target =
      axis === "row" ? { row: moved, column: pos.column } : { row: pos.row, column: moved };
    cells[formatCellRef(target)] = cell;
  }
  return cells;
}

function insert(doc: SheetDocument, sheetId: string, axis: Axis, at: number): SheetOpResult {
  return withSheet(doc, sheetId, (sheet) => {
    const size = axis === "row" ? sheet.rows : sheet.columns;
    const max = axis === "row" ? MAX_SHEET_ROWS : MAX_SHEET_COLUMNS;
    if (!Number.isInteger(at) || at < 1 || at > size + 1) return "index_out_of_range";
    if (size >= max) return "limit_reached";
    const cells = shift(sheet, axis, at, 1);
    return axis === "row"
      ? { ...sheet, rows: sheet.rows + 1, cells }
      : { ...sheet, columns: sheet.columns + 1, cells };
  });
}

function remove(doc: SheetDocument, sheetId: string, axis: Axis, at: number): SheetOpResult {
  return withSheet(doc, sheetId, (sheet) => {
    const size = axis === "row" ? sheet.rows : sheet.columns;
    if (!Number.isInteger(at) || at < 1 || at > size) return "index_out_of_range";
    if (size <= 1) return "last_line";
    const cells = shift(sheet, axis, at, -1);
    return axis === "row"
      ? { ...sheet, rows: sheet.rows - 1, cells }
      : { ...sheet, columns: sheet.columns - 1, cells };
  });
}

/** Insert an empty row so that it becomes row `at` (1..rows+1). */
export const addRow = (doc: SheetDocument, sheetId: string, at: number): SheetOpResult =>
  insert(doc, sheetId, "row", at);

/** Delete row `at` (1..rows) with its cells. The last row cannot be deleted. */
export const deleteRow = (doc: SheetDocument, sheetId: string, at: number): SheetOpResult =>
  remove(doc, sheetId, "row", at);

/** Insert an empty column so that it becomes column `at` (1 = A, up to columns+1). */
export const addColumn = (doc: SheetDocument, sheetId: string, at: number): SheetOpResult =>
  insert(doc, sheetId, "column", at);

/** Delete column `at` (1..columns) with its cells. The last column cannot be deleted. */
export const deleteColumn = (doc: SheetDocument, sheetId: string, at: number): SheetOpResult =>
  remove(doc, sheetId, "column", at);
