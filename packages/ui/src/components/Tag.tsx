import type { ReactNode } from "react";

import styles from "./Forms.module.css";

/**
 * The prototype's .tag (VIZ-0): neutral; "open" (dashed edge, e.g. "Prvo pročitajte obavijest");
 * "warn" (the prototype's .near, e.g. "Rok za 3 dana"); "accent" (a gold edge).
 */
export type TagProps = { children: ReactNode; tone?: "neutral" | "open" | "accent" | "warn" };

/** A short label beside an item (group, state, year); the text carries the meaning, the tone only marks it (WEB-05). */
export function Tag({ children, tone = "neutral" }: TagProps) {
  return <span className={styles.tag} data-tone={tone}>{children}</span>;
}
