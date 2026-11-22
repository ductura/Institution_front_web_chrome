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
  /** The prototype's .card.center: an empty or first-visit card with its text centred. */
  center?: boolean;
};

/**
 * The prototype's .card (VIZ-0): --card on a --rule-2 edge, 10 px corners,
 * 24 px inside (16 px on a phone), a 20 px Newsreader title. Loading shows the
 * prototype's grey bars with the status read out; an error is the prototype's
 * error card (the title says what, the text what it means).
 */
export function Card({ title, children, empty, busy = false, error, disabled = false, center = false }: CardProps) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id} aria-busy={busy || undefined}
      aria-disabled={disabled || undefined} data-center={center || undefined}>
      <h3 id={id} className={styles.title}>{title}</h3>
      {error ? <p role="alert" className={styles.error}>{error}</p>
        : busy ? (
          <div role="status" className={styles.loading}>
            <span className={styles.hidden}>Učitavanje…</span>
            <span aria-hidden="true" className={styles.bar} />
            <span aria-hidden="true" className={styles.bar} />
          </div>
        )
        : children ?? (empty && <p className={styles.quiet}>{empty}</p>)}
    </section>
  );
}
