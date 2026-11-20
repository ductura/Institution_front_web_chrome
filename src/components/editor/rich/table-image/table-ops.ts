/**
 * Pure table edits behind the table bar (E§3.3, E§3.6 rich). Every function
 * returns a new table that still satisfies document schema v4 §5.1: rows of
 * equal width, merges and fills in ascending (row, column) order, covered
 * cells empty and unfilled, `headerFill` only while the header is on.
 */

import type { TableCellFill, TableMerge } from "@/domain/document/schema";

export const MAX_TABLE_CELLS = 3000;
export const MAX_CELL_CODE_POINTS = 1000;

export type TableState = {
  rows: string[][];
  header: boolean;
  stripes: boolean;
  landscape: boolean;
  headerFill?: string;
  cellFills?: TableCellFill[];
  merges?: TableMerge[];
};

export type Cell = { row: number; column: number };
export type Rect = { row: number; column: number; rowSpan: number; columnSpan: number };

const COLOR = /^#[0-9a-f]{6}$/;
export const isFillColor = (value: unknown): value is string => typeof value === "string" && COLOR.test(value);

const width = (t: TableState) => t.rows[0]?.length ?? 0;
const byPosition = <T extends { row: number; column: number }>(items: T[]) =>
  items.sort((a, b) => a.row - b.row || a.column - b.column);

/** Optional lists are left out when empty (the contract rejects an empty list). */
function tidied(t: TableState, merges: TableMerge[], fills: TableCellFill[]): TableState {
  const { merges: _m, cellFills: _f, ...rest } = t;
  return {
    ...rest,
    ...(fills.length ? { cellFills: byPosition(fills) } : {}),
    ...(merges.length ? { merges: byPosition(merges) } : {}),
  };
}

/** Cells covered by a merge (all but its top left cell). */
export function coveredCells(t: TableState): Set<string> {
  const out = new Set<string>();
  for (const m of t.merges ?? []) {
    for (let r = m.row; r < m.row + m.rowSpan; r += 1) {
      for (let c = m.column; c < m.column + m.columnSpan; c += 1) if (r !== m.row || c !== m.column) out.add(`${r},${c}`);
    }
  }
  return out;
}

export function canAddRow(t: TableState): boolean {
  return (t.rows.length + 1) * width(t) <= MAX_TABLE_CELLS;
}
export function canAddColumn(t: TableState): boolean {
  return t.rows.length * (width(t) + 1) <= MAX_TABLE_CELLS;
}
export const canDeleteRow = (t: TableState) => t.rows.length > 1;
export const canDeleteColumn = (t: TableState) => width(t) > 1;

/** Shifts a coordinate at or after `at` by `by` along one axis. */
type Axis = "row" | "column";
const span = (axis: Axis) => (axis === "row" ? "rowSpan" : "columnSpan");

function insertAt(t: TableState, axis: Axis, at: number): TableState {
  const spanKey = span(axis);
  const merges = (t.merges ?? []).map((m) => {
    if (at <= m[axis]) return { ...m, [axis]: m[axis] + 1 };
    if (at < m[axis] + m[spanKey]) return { ...m, [spanKey]: m[spanKey] + 1 };
    return m;
  });
  const fills = (t.cellFills ?? []).map((f) => (at <= f[axis] ? { ...f, [axis]: f[axis] + 1 } : f));
  const rows =
    axis === "row"
      ? [...t.rows.slice(0, at), Array.from({ length: width(t) }, () => ""), ...t.rows.slice(at)]
      : t.rows.map((r) => [...r.slice(0, at), "", ...r.slice(at)]);
  return tidied({ ...t, rows }, merges, fills);
}

function removeAt(t: TableState, axis: Axis, at: number): TableState {
  const spanKey = span(axis);
  // A merge whose anchor line goes but which survives: its text and fill move to the next cell, the new anchor.
  const rows = t.rows.map((r) => r.slice());
  let fills = (t.cellFills ?? []).map((f) => ({ ...f }));
  for (const m of t.merges ?? []) {
    if (m[axis] !== at || m[spanKey] < 2) continue;
    const from = axis === "row" ? { row: at, column: m.column } : { row: m.row, column: at };
    const to = axis === "row" ? { row: at + 1, column: m.column } : { row: m.row, column: at + 1 };
    rows[to.row]![to.column] = rows[from.row]![from.column]!;
    const fill = fills.find((f) => f.row === from.row && f.column === from.column);
    fills = fills.filter((f) => f !== fill);
    if (fill) fills.push({ ...fill, row: to.row, column: to.column });
  }
  const merges: TableMerge[] = [];
  for (const m of t.merges ?? []) {
    let next = m;
    if (at < m[axis]) next = { ...m, [axis]: m[axis] - 1 };
    else if (at < m[axis] + m[spanKey]) next = { ...m, [spanKey]: m[spanKey] - 1 };
    if (next.rowSpan * next.columnSpan > 1) merges.push(next);
  }
  const keptFills = fills
    .filter((f) => f[axis] !== at)
    .map((f) => (f[axis] > at ? { ...f, [axis]: f[axis] - 1 } : f));
  const next =
    axis === "row" ? rows.filter((_, i) => i !== at) : rows.map((r) => r.filter((_, i) => i !== at));
  return tidied({ ...t, rows: next }, merges, keptFills);
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

/** A new empty row after `row` (zero-based); a no-op past the cell limit. */
export function addRowAfter(t: TableState, row: number): TableState {
  return canAddRow(t) ? insertAt(t, "row", clamp(row, t.rows.length - 1) + 1) : t;
}
export function addColumnAfter(t: TableState, column: number): TableState {
  return canAddColumn(t) ? insertAt(t, "column", clamp(column, width(t) - 1) + 1) : t;
}
export function deleteRow(t: TableState, row: number): TableState {
  return canDeleteRow(t) ? removeAt(t, "row", clamp(row, t.rows.length - 1)) : t;
}
export function deleteColumn(t: TableState, column: number): TableState {
  return canDeleteColumn(t) ? removeAt(t, "column", clamp(column, width(t) - 1)) : t;
}

export function setHeader(t: TableState, header: boolean): TableState {
  if (header) return { ...t, header };
  const { headerFill: _gone, ...rest } = t;
  return { ...rest, header };
}
export const setStripes = (t: TableState, stripes: boolean): TableState => ({ ...t, stripes });
export const setLandscape = (t: TableState, landscape: boolean): TableState => ({ ...t, landscape });

/** Header colour; only with the header on. Null clears it. */
export function setHeaderFill(t: TableState, color: string | null): TableState {
  const { headerFill: _old, ...rest } = t;
  return color !== null && t.header && isFillColor(color) ? { ...rest, headerFill: color } : rest;
}

/** Fill of one cell; a covered cell takes none. Null clears. */
export function setCellFill(t: TableState, cell: Cell, color: string | null): TableState {
  if (coveredCells(t).has(`${cell.row},${cell.column}`)) return t;
  const others = (t.cellFills ?? []).filter((f) => f.row !== cell.row || f.column !== cell.column);
  const fills = color !== null && isFillColor(color) ? [...others, { color, column: cell.column, row: cell.row }] : others;
  return tidied(t, t.merges ?? [], fills);
}

const overlaps = (a: Rect, b: Rect) =>
  a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan && a.column < b.column + b.columnSpan && b.column < a.column + a.columnSpan;

/** False when the joined text of the rectangle would pass 1000 code points: nothing may be cut silently. */
export function canMergeText(t: TableState, rect: Rect): boolean {
  const texts: string[] = [];
  for (let r = rect.row; r < rect.row + rect.rowSpan; r += 1) {
    for (let c = rect.column; c < rect.column + rect.columnSpan; c += 1) {
      const text = t.rows[r]?.[c]?.trim();
      if (text) texts.push(text);
    }
  }
  return Array.from(texts.join(" ")).length <= MAX_CELL_CODE_POINTS;
}

/**
 * Merges a rectangle into its top left cell. The text of the other cells is
 * appended to the first (space-separated, empty ones skipped) so nothing the
 * student wrote is lost; the contract wants covered cells empty. Refused (the
 * table is returned as it was) when the rectangle is one cell, leaves the
 * table, or touches an existing merge.
 */
export function mergeCells(t: TableState, rect: Rect): TableState {
  const { row, column, rowSpan, columnSpan } = rect;
  const inside =
    row >= 0 && column >= 0 && rowSpan >= 1 && columnSpan >= 1 && row + rowSpan <= t.rows.length && column + columnSpan <= width(t);
  if (!inside || rowSpan * columnSpan < 2) return t;
  if ((t.merges ?? []).some((m) => overlaps(m, rect))) return t;
  const texts: string[] = [];
  const rows = t.rows.map((r) => r.slice());
  if (!canMergeText(t, rect)) return t;
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = column; c < column + columnSpan; c += 1) {
      const text = rows[r]![c]!.trim();
      if (text) texts.push(text);
      if (r !== row || c !== column) rows[r]![c] = "";
    }
  }
  rows[row]![column] = texts.join(" ");
  const fills = (t.cellFills ?? []).filter(
    (f) => !(f.row >= row && f.row < row + rowSpan && f.column >= column && f.column < column + columnSpan && (f.row !== row || f.column !== column)),
  );
  return tidied({ ...t, rows }, [...(t.merges ?? []), { column, columnSpan, row, rowSpan }], fills);
}

/** Removes the merge that covers `cell`. */
export function unmergeCell(t: TableState, cell: Cell): TableState {
  const keep = (t.merges ?? []).filter((m) => !overlaps(m, { ...cell, rowSpan: 1, columnSpan: 1 }));
  return tidied(t, keep, t.cellFills ?? []);
}

/** Cell text as the contract wants it: no line break, at most 1000 code points. */
export function tidyCell(text: string): string {
  return Array.from(text.replace(/\r\n|[\r\n]/g, " ").trim()).slice(0, MAX_CELL_CODE_POINTS).join("");
}

/** Sets the text of one cell; a covered cell cannot hold text. */
export function setCellText(t: TableState, cell: Cell, text: string): TableState {
  if (coveredCells(t).has(`${cell.row},${cell.column}`)) return t;
  if (!t.rows[cell.row]?.[cell.column] && t.rows[cell.row]?.[cell.column] !== "") return t;
  const rows = t.rows.map((r, i) => (i === cell.row ? r.map((v, j) => (j === cell.column ? tidyCell(text) : v)) : r));
  return { ...t, rows };
}

/** A column is numeric when every non-empty body cell reads as a number; the sheet right-aligns it. */
export function isNumeric(text: string): boolean {
  return /^[-+−]?\d+([ .]\d{3})*([,.]\d+)?\s*%?$/.test(text.trim());
}
