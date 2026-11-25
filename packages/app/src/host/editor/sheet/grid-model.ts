/**
 * Pure model of the spreadsheet grid (WEB-V14-SHEET-GRID): what a typed text
 * means for a cell, what a cell shows, how the selection moves by key, and the
 * undo history. No React and no DOM; the components only draw this.
 */
import {
  MAX_CELL_TEXT_LENGTH,
  MAX_FORMULA_LENGTH,
  MAX_SHEETS,
  MAX_SHEET_FILLED_CELLS,
  countFilledCells,
  formatCellRef,
  isFilledCell,
  parseCellRef,
  parseDecimalText,
  roundResult,
  validateSheetDocument,
  type ComputedCell,
  type FormulaErrorCode,
  type Sheet,
  type SheetCell,
  type SheetDocument,
} from "../../../../../editor-core/src/sheet/index.ts";

export type RefusalCode =
  | "too_many_cells"
  | "cell_too_long"
  | "formula_too_long"
  | "formula_empty"
  | "sheet_not_found"
  | "out_of_range"
  | "invalid";

export type EditResult = { ok: true; doc: SheetDocument } | { ok: false; error: RefusalCode };

/** What a typed text means: nothing (clears the cell), or the cell to store. */
export type CellInput = { kind: "clear" } | { kind: "cell"; cell: SheetCell } | { kind: "refused"; error: RefusalCode };

export function parseCellInput(text: string): CellInput {
  if (text === "") return { kind: "clear" };
  if (text.startsWith("=")) {
    if (text.length < 2) return { kind: "refused", error: "formula_empty" };
    if ([...text].length > MAX_FORMULA_LENGTH) return { kind: "refused", error: "formula_too_long" };
    return { kind: "cell", cell: { value: null, formula: text } };
  }
  if ([...text].length > MAX_CELL_TEXT_LENGTH) return { kind: "refused", error: "cell_too_long" };
  const number = parseDecimalText(text.trim().replace(",", "."));
  return { kind: "cell", cell: { value: number ?? text } };
}

/** The text the editor starts from: the formula as written, else the value as typed. */
export function cellInputText(cell: SheetCell | undefined): string {
  if (cell === undefined) return "";
  if (cell.formula !== undefined) return cell.formula;
  if (typeof cell.value === "number") return formatNumber(cell.value);
  return cell.value ?? "";
}

export function formatNumber(value: number): string {
  return String(roundResult(value)).replace(".", ",");
}

export type CellDisplay = { text: string; error: FormulaErrorCode | null };

/** What a cell shows: a formula's computed result (never a stored one), a constant, or nothing. */
export function displayCell(cell: SheetCell | undefined, computed: ComputedCell | undefined): CellDisplay {
  if (computed?.type === "error") return { text: computed.code, error: computed.code };
  if (computed?.type === "number") return { text: formatNumber(computed.value), error: null };
  if (computed?.type === "text") return { text: computed.value, error: null };
  if (cell === undefined) return { text: "", error: null };
  if (typeof cell.value === "number") return { text: formatNumber(cell.value), error: null };
  return { text: cell.value ?? "", error: null };
}

function replaceSheet(doc: SheetDocument, sheetId: string, change: (sheet: Sheet) => Sheet): EditResult {
  const index = doc.sheets.findIndex((s) => s.id === sheetId);
  if (index < 0) return { ok: false, error: "sheet_not_found" };
  const sheets = doc.sheets.slice();
  sheets[index] = change(doc.sheets[index]!);
  const next = { ...doc, sheets };
  // The document leaves here only if the shared validator accepts it: the server will.
  return validateSheetDocument(next).ok ? { ok: true, doc: next } : { ok: false, error: "invalid" };
}

/** Writes the text typed into one cell (an empty text clears it). The input document is never changed. */
export function setCellText(doc: SheetDocument, sheetId: string, ref: string, text: string): EditResult {
  const sheet = doc.sheets.find((s) => s.id === sheetId);
  if (sheet === undefined) return { ok: false, error: "sheet_not_found" };
  const at = parseCellRef(ref);
  if (at === null || at.row > sheet.rows || at.column > sheet.columns) return { ok: false, error: "out_of_range" };
  const input = parseCellInput(text);
  if (input.kind === "refused") return { ok: false, error: input.error };
  const before = sheet.cells[ref];
  if (input.kind === "cell" && (before === undefined || !isFilledCell(before)) && countFilledCells(doc) >= MAX_SHEET_FILLED_CELLS) {
    return { ok: false, error: "too_many_cells" };
  }
  return replaceSheet(doc, sheetId, (s) => {
    const cells = { ...s.cells };
    if (input.kind === "clear") delete cells[ref];
    else cells[ref] = input.cell;
    return { ...s, cells };
  });
}

/** Clears every cell of a range in one step (Delete); a range of empty cells changes nothing. */
export function clearRange(doc: SheetDocument, sheetId: string, range: Range): EditResult {
  return replaceSheet(doc, sheetId, (s) => {
    const cells = { ...s.cells };
    for (let row = range.top; row <= range.bottom; row += 1) {
      for (let column = range.left; column <= range.right; column += 1) delete cells[formatCellRef({ row, column })];
    }
    return { ...s, cells };
  });
}

/** Adds an empty sheet named by the next free "ListN"; refused at the limit of five. */
export function addSheet(doc: SheetDocument, nextId: () => string): EditResult {
  if (doc.sheets.length >= MAX_SHEETS) return { ok: false, error: "invalid" };
  const names = new Set(doc.sheets.map((s) => s.name));
  let n = doc.sheets.length + 1;
  while (names.has(`List${n}`)) n += 1;
  const ids = new Set(doc.sheets.map((s) => s.id));
  let id = nextId();
  while (ids.has(id)) id = nextId();
  const next = { ...doc, sheets: [...doc.sheets, { id, name: `List${n}`, rows: 1, columns: 1, cells: {} }] };
  return validateSheetDocument(next).ok ? { ok: true, doc: next } : { ok: false, error: "invalid" };
}

// ---------------------------------------------------------------- selection

export type Position = { row: number; column: number };
export type Selection = { active: Position; focus: Position };
export type Range = { top: number; left: number; bottom: number; right: number };

export const startSelection = (): Selection => ({ active: { row: 1, column: 1 }, focus: { row: 1, column: 1 } });

export function rangeOf(sel: Selection): Range {
  return {
    top: Math.min(sel.active.row, sel.focus.row),
    bottom: Math.max(sel.active.row, sel.focus.row),
    left: Math.min(sel.active.column, sel.focus.column),
    right: Math.max(sel.active.column, sel.focus.column),
  };
}

export const inRange = (range: Range, at: Position): boolean =>
  at.row >= range.top && at.row <= range.bottom && at.column >= range.left && at.column <= range.right;

export function rangeName(range: Range): string {
  const from = formatCellRef({ row: range.top, column: range.left });
  const to = formatCellRef({ row: range.bottom, column: range.right });
  return from === to ? from : `${from}:${to}`;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 1), max);

/** Keeps a selection inside the sheet (after a sheet switch or a smaller sheet). */
export function clampSelection(sel: Selection, sheet: Pick<Sheet, "rows" | "columns">): Selection {
  const fit = (p: Position): Position => ({ row: clamp(p.row, sheet.rows), column: clamp(p.column, sheet.columns) });
  return { active: fit(sel.active), focus: fit(sel.focus) };
}

export type MoveKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

/**
 * Arrow keys move the active cell; Shift extends the range from it; Home/End go to the ends of the row and
 * with Ctrl to the first and the last cell of the sheet.
 */
export function moveSelection(sel: Selection, key: MoveKey, opts: { shift: boolean; ctrl: boolean }, sheet: Pick<Sheet, "rows" | "columns">): Selection {
  const from = opts.shift ? sel.focus : sel.active;
  let row = from.row;
  let column = from.column;
  if (key === "ArrowUp") row -= 1;
  else if (key === "ArrowDown") row += 1;
  else if (key === "ArrowLeft") column -= 1;
  else if (key === "ArrowRight") column += 1;
  else if (key === "Home") {
    column = 1;
    if (opts.ctrl) row = 1;
  } else {
    column = sheet.columns;
    if (opts.ctrl) row = sheet.rows;
  }
  const focus = { row: clamp(row, sheet.rows), column: clamp(column, sheet.columns) };
  return opts.shift ? { active: sel.active, focus } : { active: focus, focus };
}

/** Where Enter (down) and Tab (right) go after a commit; Shift reverses. Stays put at an edge. */
export function stepAfterCommit(sel: Selection, key: "Enter" | "Tab", shift: boolean, sheet: Pick<Sheet, "rows" | "columns">): Selection {
  const at = sel.active;
  const dir = shift ? -1 : 1;
  const next = key === "Enter" ? { row: at.row + dir, column: at.column } : { row: at.row, column: at.column + dir };
  const cell = { row: clamp(next.row, sheet.rows), column: clamp(next.column, sheet.columns) };
  return { active: cell, focus: cell };
}

// ------------------------------------------------------------------ history

export const MAX_HISTORY = 100;
export type History = { past: SheetDocument[]; future: SheetDocument[] };
export const emptyHistory = (): History => ({ past: [], future: [] });

/** Remembers `before` as the state to return to; a new edit drops the redo line. */
export function recordEdit(history: History, before: SheetDocument): History {
  return { past: [...history.past, before].slice(-MAX_HISTORY), future: [] };
}

export function undo(history: History, current: SheetDocument): { history: History; doc: SheetDocument } | null {
  const doc = history.past[history.past.length - 1];
  if (doc === undefined) return null;
  return { doc, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

export function redo(history: History, current: SheetDocument): { history: History; doc: SheetDocument } | null {
  const doc = history.future[0];
  if (doc === undefined) return null;
  return { doc, history: { past: [...history.past, current], future: history.future.slice(1) } };
}

/** A key that starts typing into the cell: one printable character without Ctrl/Meta/Alt. */
export const isTypingKey = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

export function columnName(column: number): string {
  return String.fromCharCode(64 + column);
}
