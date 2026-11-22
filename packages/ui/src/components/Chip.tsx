import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Chip.module.css";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** A filter chip: pressed when its filter is on. */
  pressed?: boolean;
};

/** The editor side panel's filter chip (prototype .chip): a pill button, `aria-pressed` carries the state. */
export function Chip({ children, pressed, type = "button", ...rest }: ChipProps) {
  return <button {...rest} type={type} className={styles.chip} aria-pressed={pressed}>{children}</button>;
}

export type PillTagProps = { children: ReactNode; tone?: "neutral" | "warn" | "err" | "ok" | "me" | "new" };

/** The editor side panel's small status pill (prototype .tag): the text carries the meaning, the tone only marks it. */
export function PillTag({ children, tone = "neutral" }: PillTagProps) {
  return <span className={styles.pill} data-tone={tone}>{children}</span>;
}
