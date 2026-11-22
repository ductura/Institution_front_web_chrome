"use client";

import type { ReactNode } from "react";

import styles from "./SegmentedControl.module.css";

export type SegmentedOption = {
  readonly value: string;
  readonly label: ReactNode;
  /** Name for assistive technology when `label` is shortened on a narrow screen. */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  /** Why the option is disabled, or what it does, as a tooltip. */
  readonly title?: string;
};

export type SegmentedControlProps = {
  /** The group's name for assistive technology. */
  readonly label: string;
  readonly options: readonly SegmentedOption[];
  /** The value pressed now; null when none is. */
  readonly value: string | null;
  readonly onChange?: (value: string) => void;
  readonly className?: string;
};

/**
 * The prototype's `.seg` (editor top bar: "Pisanje / Kako vidi nastavnik"):
 * a recessed pill holding buttons, the pressed one raised in the chrome colour
 * and set in weight 500, so the choice never rests on colour alone. Each button
 * carries `aria-pressed`; none is a tab, because the choice does not swap panels.
 */
export function SegmentedControl({ label, options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div role="group" aria-label={label} className={[styles.seg, className].filter(Boolean).join(" ")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
