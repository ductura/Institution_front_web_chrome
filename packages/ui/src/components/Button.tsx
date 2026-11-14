import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "quiet";
  /** Work in progress: the button stays focusable but does nothing (aria-disabled). */
  busy?: boolean;
};

export function Button({ tone = "primary", busy = false, type = "button", className, onClick, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.button, className].filter(Boolean).join(" ")}
      data-tone={tone}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      // aria-disabled alone would still submit a form: a busy click does nothing.
      onClick={busy ? (event) => event.preventDefault() : onClick}
    />
  );
}
