import { Fragment } from "react";

import { diffMessages as t } from "./messages.hr";
import styles from "./DiffView.module.css";

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

export type DiffViewProps = {
  /** Ordered diff fragments. Include spaces and line breaks in their text. */
  parts: readonly DiffPart[];
};

export function DiffView({ parts }: DiffViewProps) {
  if (!parts.some(({ kind, text }) => kind !== "same" && text.length > 0)) {
    return <p role="status">{t.empty}</p>;
  }

  return (
    <div role="group" aria-label={t.label}>
      <p className={styles.legend} aria-hidden="true">
        <span className={styles.added}>{t.added}</span>
        <span className={styles.removed}>{t.removed}</span>
      </p>
      <p className={styles.text}>
        {parts.map(({ kind, text }, index) => {
          if (kind === "same" || text.length === 0) return <Fragment key={index}>{text}</Fragment>;
          const Mark = kind === "added" ? "ins" : "del";
          return (
            <Mark className={styles[kind]} key={index}>
              <span className={styles.srOnly}>{t[kind]}: </span>{text}
            </Mark>
          );
        })}
      </p>
    </div>
  );
}
