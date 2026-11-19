"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import { Skeleton } from "../components/Skeleton";
import { tableMessages as t } from "./messages.hr";
import { nextSort, sortRows, type SortKey, type SortState } from "./sort";
import styles from "./table.module.css";

export type DataTableColumn<R> = {
  id: string;
  header: string;
  cell: (row: R) => ReactNode;
  /** When given, the header is a button that sorts by this key. */
  sortValue?: (row: R) => SortKey;
  /** The column that names the row (e.g. the student): its cells are row headers. */
  rowHeader?: boolean;
  numeric?: boolean;
};

export type DataTableProps<R> = {
  caption: ReactNode;
  columns: readonly DataTableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** Shown in one cell under the headers when there are no rows. */
  empty: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  initialSort?: SortState;
};

const ARROWS = { ascending: "↑", descending: "↓" } as const;

/**
 * A data table (WEB-29): a native table with a caption, column headers with
 * scope="col" and the naming column as scope="row" headers, so a screen
 * reader reads the header with each cell. Sorting is a button in the header
 * (Enter or Space), shown by aria-sort and announced once. On a narrow screen
 * the table scrolls inside a focusable region instead of losing its shape.
 */
export function DataTable<R>({
  caption, columns, rows, rowKey, empty, loading = false, loadingLabel = t.loading, initialSort,
}: DataTableProps<R>) {
  const captionId = useId();
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [announced, setAnnounced] = useState("");

  const sorted = useMemo(() => {
    const key = sort ? columns.find((column) => column.id === sort.column)?.sortValue : undefined;
    return key && sort ? sortRows(rows, key, sort.direction) : rows;
  }, [rows, columns, sort]);

  function press(column: DataTableColumn<R>) {
    const next = nextSort(sort, column.id);
    setSort(next);
    setAnnounced(t.sortedBy.replace("{column}", column.header).replace("{direction}", t[next.direction]));
  }

  const numeric = (column: DataTableColumn<R>) => (column.numeric ? true : undefined);
  const body = loading
    ? <tr><td colSpan={columns.length}><Skeleton label={loadingLabel} /></td></tr>
    : sorted.length === 0
      ? <tr><td colSpan={columns.length} className={styles.empty}>{empty}</td></tr>
      : sorted.map((row) => (
        <tr key={rowKey(row)}>
          {columns.map((column) => column.rowHeader
            ? <th key={column.id} scope="row" data-numeric={numeric(column)}>{column.cell(row)}</th>
            : <td key={column.id} data-numeric={numeric(column)}>{column.cell(row)}</td>)}
        </tr>
      ));

  return (
    <div className={styles.wrap}>
      <div role="region" aria-labelledby={captionId} tabIndex={0} className={styles.scroll}>
        <table className={styles.table} aria-busy={loading || undefined}>
          <caption id={captionId} className={styles.caption}>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const direction = sort?.column === column.id ? sort.direction : undefined;
                return (
                  <th key={column.id} scope="col" aria-sort={column.sortValue ? direction : undefined} data-numeric={numeric(column)}>
                    {column.sortValue
                      ? (
                        <button type="button" className={styles.sort} onClick={() => press(column)}>
                          {column.header}
                          <span aria-hidden="true" className={styles.arrow}>{direction ? ARROWS[direction] : "↕"}</span>
                        </button>
                      )
                      : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      <p role="status" className={styles.hidden}>{announced}</p>
    </div>
  );
}
