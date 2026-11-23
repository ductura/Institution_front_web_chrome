import type { ButtonHTMLAttributes, Ref } from "react";

import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * The prototype's buttons (VIZ-0): primary (gold), secondary (outlined),
   * ghost (underlined text). "quiet" is the older name of secondary and looks the same.
   */
  tone?: "primary" | "secondary" | "quiet" | "ghost";
  /** regular: 44 px, 14 px sides; small: 44 px, 10 px sides; dense: 32 px for dense bars. */
  size?: "regular" | "small" | "dense";
  /** Work in progress: the button stays focusable but does nothing (aria-disabled). */
  busy?: boolean;
  /** React 19 passes a ref as a prop; a dialog's initialFocus points here (WEB-04). */
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ tone = "primary", size = "regular", busy = false, type = "button", className, onClick, "aria-disabled": ariaDisabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.button, className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-size={size === "regular" ? undefined : size}
      aria-busy={busy || undefined}
      // The caller's own aria-disabled (a step that is not open yet, the prototype's dimmed "Dalje") shows as well.
      aria-disabled={busy || ariaDisabled === true || ariaDisabled === "true" || undefined}
      // aria-disabled alone would still submit a form: a busy click does nothing.
      onClick={busy ? (event) => event.preventDefault() : onClick}
    />
  );
}
