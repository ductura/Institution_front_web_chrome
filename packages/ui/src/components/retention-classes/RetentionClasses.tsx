"use client";

import { Button } from "../Button";
import { DataTable, type DataTableColumn } from "../../table";
import styles from "./RetentionClasses.module.css";

export type RetentionMode = "dry_run" | "delete";

/** One data class with its retention period; `retentionDays` is null until the period is decided. */
export type RetentionClass = {
  readonly classId: string;
  readonly name: string;
  readonly retentionDays: number | null;
  readonly mode: RetentionMode;
};

export type RetentionClassesLabels = {
  title: string;
  /** What the page is and what it does not do (it only shows; nothing is deleted from here). */
  lead: string;
  caption: string;
  colClass: string;
  colPeriod: string;
  colMode: string;
  /** For `retentionDays === null`: „Rok još nije određen”. */
  periodUndecided: string;
  period: (days: number) => string;
  modes: Readonly<Record<RetentionMode, string>>;
  empty: string;
  loading: string;
  retry: string;
};

export type RetentionClassesState =
  | { readonly kind: "loading" }
  /** `message` is the catalogue text for the server's answer, never a raw code. */
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly classes: readonly RetentionClass[] };

export type RetentionClassesProps = {
  labels: RetentionClassesLabels;
  state: RetentionClassesState;
  onRetry?: () => void;
};

/**
 * The institution's data classes with their retention period and mode (M10.7, A-05). It only
 * shows: no control here deletes or changes anything.
 */
export function RetentionClasses({ labels, state, onRetry }: RetentionClassesProps) {
  const columns: DataTableColumn<RetentionClass>[] = [
    { id: "class", header: labels.colClass, cell: (c) => c.name, rowHeader: true },
    { id: "period", header: labels.colPeriod, cell: (c) => (c.retentionDays === null ? labels.periodUndecided : labels.period(c.retentionDays)) },
    { id: "mode", header: labels.colMode, cell: (c) => labels.modes[c.mode] },
  ];
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{labels.title}</h2>
      <p className={styles.lead}>{labels.lead}</p>
      {state.kind === "error" ? (
        <div className={styles.fail}>
          <p role="alert" className={styles.alert}>{state.message}</p>
          {onRetry === undefined ? null : <Button tone="quiet" onClick={onRetry}>{labels.retry}</Button>}
        </div>
      ) : (
        <DataTable
          caption={labels.caption}
          columns={columns}
          rows={state.kind === "ready" ? state.classes : []}
          rowKey={(c) => c.classId}
          empty={labels.empty}
          loading={state.kind === "loading"}
          loadingLabel={labels.loading}
        />
      )}
    </div>
  );
}
