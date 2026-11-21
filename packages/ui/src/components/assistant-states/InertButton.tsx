import type { ReactNode } from "react";

import buttonStyles from "../Button.module.css";

export type InertButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "quiet";
  /** Not available: stays focusable and in the tab order, but does nothing (aria-disabled). */
  inert?: boolean;
  /** Work in progress: like inert, and announced as busy. */
  busy?: boolean;
  /** Id of the text that says why the action is not available. */
  describedBy?: string;
  /** For a choice in a set: whether it is the chosen one (aria-pressed). */
  pressed?: boolean;
};

/**
 * A button that is never removed from the keyboard path: when it cannot act it says so with
 * aria-disabled and ignores clicks, Enter and Space (s16, "Tipkovnica").
 */
export function InertButton({ children, onClick, tone = "primary", inert = false, busy = false, describedBy, pressed }: InertButtonProps) {
  const off = inert || busy;
  return (
    <button
      type="button"
      className={buttonStyles.button}
      data-tone={tone}
      aria-disabled={off || undefined}
      aria-busy={busy || undefined}
      aria-describedby={describedBy}
      aria-pressed={pressed}
      onClick={off ? (event) => event.preventDefault() : onClick}
    >
      {children}
    </button>
  );
}
