import type { DetailsHTMLAttributes, ReactNode } from "react";

import styles from "./Forms.module.css";

export type DetailsProps = Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "children"> & {
  summary: string;
  children: ReactNode;
};

/** Native details and summary (WEB-05): Enter and Space open it, no script needed. */
export function Details({ summary, children, className, ...rest }: DetailsProps) {
  return (
    <details {...rest} className={[styles.details, className].filter(Boolean).join(" ")}>
      <summary className={styles.summary}>{summary}</summary>
      <div className={styles.detailsBody}>{children}</div>
    </details>
  );
}
