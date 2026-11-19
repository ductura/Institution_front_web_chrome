import type { ReactNode } from "react";

import { Details } from "../components/Details";
import styles from "./key-value.module.css";

export type KeyValueItem = {
  id: string;
  label: string;
  value: ReactNode;
  details?: { summary: string; children: ReactNode };
};

export type KeyValueListProps = { items: readonly KeyValueItem[] };

export function KeyValueList({ items }: KeyValueListProps) {
  return (
    <dl className={styles.list}>
      {items.map(({ id, label, value, details }) => (
        <div key={id} className={styles.entry}>
          <dt>{label}</dt>
          <dd>
            {value}
            {details && <Details className={styles.details} {...details} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
