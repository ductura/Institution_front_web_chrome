import { useId, type ReactNode } from "react";

import styles from "./Card.module.css";

export type CardProps = {
  title: string;
  children?: ReactNode;
  /** What an empty card says instead of content. */
  empty?: string;
  busy?: boolean;
  error?: string;
  disabled?: boolean;
};

export function Card({ title, children, empty, busy = false, error, disabled = false }: CardProps) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id} aria-busy={busy || undefined}
      aria-disabled={disabled || undefined}>
      <h3 id={id} className={styles.title}>{title}</h3>
      {error ? <p role="alert" className={styles.error}>{error}</p>
        : busy ? <p className={styles.quiet}>Učitavanje…</p>
        : children ?? (empty && <p className={styles.quiet}>{empty}</p>)}
    </section>
  );
}
