"use client";

import styles from "./CheckActionList.module.css";
import { orderFindings, selectionOf, type CheckFinding, type CheckSelection } from "./list-logic";

export type CheckActionListLabels = {
  /** Accessible name of the list. */
  list: string;
  /** Shown when there are no findings. */
  empty: string;
  required: string;
  advisory: string;
};

export type CheckActionListProps = {
  findings: readonly CheckFinding[];
  labels: CheckActionListLabels;
  /** Reports the stable ids of the chosen finding and action; the app decides what happens. */
  onAction: (selection: CheckSelection) => void;
};

/**
 * A list of check findings with an action each. Required findings come before advisory ones.
 * No route, no data access: the app passes findings and the callback.
 */
export function CheckActionList({ findings, labels, onAction }: CheckActionListProps) {
  if (findings.length === 0) {
    return <p className={styles.empty} role="status">{labels.empty}</p>;
  }
  const ordered = orderFindings(findings);
  return (
    <ul className={styles.list} aria-label={labels.list}>
      {ordered.map((finding) => (
        <li key={finding.id} className={styles.item} data-finding-id={finding.id} data-severity={finding.severity}>
          <p className={styles.head}>
            <span className={styles.severity}>{finding.severity === "required" ? labels.required : labels.advisory}</span>
            <strong className={styles.title}>{finding.title}</strong>
          </p>
          {finding.detail ? <p className={styles.detail}>{finding.detail}</p> : null}
          {finding.actions.length > 0 && (
            <div className={styles.actions}>
              {finding.actions.map((action) => (
                <button key={action.id} type="button" className={styles.button}
                  onClick={() => {
                    const selection = selectionOf(findings, finding.id, action.id);
                    if (selection) onAction(selection);
                  }}>
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
