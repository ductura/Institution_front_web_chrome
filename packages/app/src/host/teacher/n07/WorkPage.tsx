"use client";

import type { ReactNode } from "react";

import styles from "./work-page.module.css";

export { styles as workPageStyles };

/**
 * The frame of the prototype's work pages (`.sb-wrap`, `.sb-bar`, `.sb-page`): a sticky bar with the way back and
 * the page below it. N-07, N-09, N-10 and N-11 share it; the markup follows Ductura_nastavnik.html `page()`.
 */
export function WorkPage({ back, backLabel, crumb, status, two = false, wide = false, children }: {
  back: string; backLabel: string; crumb?: ReactNode;
  /** Oznaka stanja desno u traci (otisak verzije kod nastavnika). */
  status?: ReactNode;
  two?: boolean; wide?: boolean; children: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <header className={styles.bar}>
        <a className="btn ghost" href={back}>{backLabel}</a>
        {crumb !== undefined && <p className={styles.crumb}>{crumb}</p>}
        {status}
      </header>
      <div className={`${styles.page}${two ? ` ${styles.two}` : ""}${wide ? ` ${styles.wide}` : ""}`}>{children}</div>
    </div>
  );
}

/** The prototype's `panel()`: a `.panel.sb-panel` with the `.sb-top` heading row (title and optional tag) and `.sb-body`. */
export function WorkPanel({ id, title, tag, level = 1, busy = false, stick = false, children }: {
  id: string; title: ReactNode; tag?: ReactNode; level?: 1 | 2; busy?: boolean; stick?: boolean; children: ReactNode;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <section className={`panel ${styles.panel}${stick ? ` ${styles.stick}` : ""}`} aria-labelledby={id} aria-busy={busy || undefined}>
      <div className={styles.top}>
        <Heading id={id}>{title}</Heading>
        {tag !== undefined && tag !== null && <span className="tag">{tag}</span>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** `.sb-kv`: label left, value right in the mono face. */
export function Kv({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className={styles.kv}><span>{label}</span><b>{children}</b></div>;
}

/** `.sb-state`: a titled block with a rule above it. */
export function StateBlock({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <div className={styles.state}><span className={styles.heading}>{title}</span>{children}</div>;
}
