"use client";

import { Button } from "@ductura/ui";

import { tableImageMessages as t } from "./messages.hr";
import styles from "./table-image.module.css";
import {
  canAddColumn, canAddRow, canDeleteColumn, canDeleteRow, coveredCells,
  type Cell, type TableState,
} from "./table-ops";

export type TableAction =
  | "rowAdd" | "rowDelete" | "columnAdd" | "columnDelete"
  | "header" | "stripes" | "landscape" | "merge" | "unmerge";

type Props = {
  table: TableState;
  /** The cell the caret is in; row and column edits apply there. */
  cell: Cell;
  /** Selected rectangle, when more than one cell is selected (enables "Spoji"). */
  canMerge?: boolean;
  /** The fill colours the sheet offers, as #rrggbb. */
  fills: readonly string[];
  onAction: (action: TableAction) => void;
  onHeaderFill: (color: string | null) => void;
  onCellFill: (color: string | null) => void;
};

/** The bar beside a table (E§3.6 rich). Edits are the caller's; this only reports them. */
export function TableBar({ table, cell, canMerge = false, fills, onAction, onHeaderFill, onCellFill }: Props) {
  const merged = (table.merges ?? []).some(
    (m) => cell.row >= m.row && cell.row < m.row + m.rowSpan && cell.column >= m.column && cell.column < m.column + m.columnSpan,
  );
  const covered = coveredCells(table).has(`${cell.row},${cell.column}`);
  const hint = !canAddRow(table) || !canAddColumn(table) ? t.tooLarge : undefined;
  const toggle = (name: TableAction, label: string, on: boolean, title?: string) => (
    <Button tone="quiet" aria-pressed={on} title={title} onClick={() => onAction(name)}>{label}</Button>
  );
  const colour = (label: string, value: string | undefined, disabled: boolean, set: (color: string | null) => void) => (
    <label className={styles.fill}>
      <span>{label}</span>
      <select disabled={disabled} value={value ?? ""} onChange={(e) => set(e.target.value || null)}>
        <option value="">{t.fillNone}</option>
        {fills.map((color) => <option key={color} value={color}>{color}</option>)}
      </select>
    </label>
  );
  return (
    <div role="toolbar" aria-label={t.tableBar} className={styles.bar} contentEditable={false}>
      <Button tone="quiet" busy={!canAddRow(table)} title={hint} onClick={() => onAction("rowAdd")}>{t.rowAdd}</Button>
      <Button tone="quiet" busy={!canDeleteRow(table)} title={canDeleteRow(table) ? undefined : t.lastRow} onClick={() => onAction("rowDelete")}>{t.rowDelete}</Button>
      <Button tone="quiet" busy={!canAddColumn(table)} title={hint} onClick={() => onAction("columnAdd")}>{t.columnAdd}</Button>
      <Button tone="quiet" busy={!canDeleteColumn(table)} title={canDeleteColumn(table) ? undefined : t.lastColumn} onClick={() => onAction("columnDelete")}>{t.columnDelete}</Button>
      {toggle("header", t.header, table.header)}
      {toggle("stripes", t.stripes, table.stripes)}
      {toggle("landscape", t.landscape, table.landscape, t.landscapeTitle)}
      {merged
        ? <Button tone="quiet" onClick={() => onAction("unmerge")}>{t.unmerge}</Button>
        : <Button tone="quiet" busy={!canMerge} title={t.mergeNote} onClick={() => onAction("merge")}>{t.merge}</Button>}
      {colour(t.headerFill, table.headerFill, !table.header, onHeaderFill)}
      {colour(t.cellFill, (table.cellFills ?? []).find((f) => f.row === cell.row && f.column === cell.column)?.color, covered, onCellFill)}
    </div>
  );
}
