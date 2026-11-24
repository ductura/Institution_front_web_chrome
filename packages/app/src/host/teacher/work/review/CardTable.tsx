"use client";

import { DataTable, type DataTableProps } from "@ductura/ui";
import { useId, useSyncExternalStore } from "react";

import styles from "./card-table.module.css";

/** Below the prototype's 760 px break the tables of the review become cards (NF-5 PG-12). */
export const NARROW = "(max-width: 759px)";

const subscribe = (query: string) => (notify: () => void): (() => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(query);
  list.addEventListener("change", notify);
  return () => list.removeEventListener("change", notify);
};

/** True on a narrow screen; false on the server and where the browser has no matchMedia. */
export function useNarrow(query: string = NARROW): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * NF-5 PG-12, PG-13: the review's table, or on a phone one card per row. A card names every value with its
 * column header (a description list), so the header is read with the value as in the table (`scope`), and the
 * list keeps the table's caption as its name. Print always gets the table.
 */
export function CardTable<R>(props: DataTableProps<R>) {
  const narrow = useNarrow();
  const captionId = useId();
  if (!narrow) return <DataTable {...props} />;
  const { caption, columns, rows, rowKey, empty } = props;
  return (
    <div data-cards>
      <p id={captionId} className="meta">{caption}</p>
      {rows.length === 0 ? <p className="note">{empty}</p> : (
        <ul className={styles.cards} aria-labelledby={captionId}>
          {rows.map((row) => (
            <li key={rowKey(row)} className={`panel ${styles.card}`}>
              <dl className={styles.fields}>
                {columns.map((column) => (
                  <div key={column.id} className={styles.field}>
                    <dt className="meta">{column.header}</dt>
                    <dd>{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
