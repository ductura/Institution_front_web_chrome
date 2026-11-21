import type { ReactNode } from "react";

import styles from "./Forms.module.css";

export type TagProps = { children: ReactNode; tone?: "neutral" | "accent" | "warn" };

/** A short label beside an item (group, state, year); the text carries the meaning, the tone only marks it (WEB-05). */
export function Tag({ children, tone = "neutral" }: TagProps) {
  return <span className={styles.tag} data-tone={tone}>{children}</span>;
}
