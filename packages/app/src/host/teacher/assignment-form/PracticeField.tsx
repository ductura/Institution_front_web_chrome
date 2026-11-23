"use client";

import { Checkbox } from "@ductura/ui";

import { practiceOf } from "./form-checks";
import { assignmentFormHr as f } from "./messages.hr";

/** The "Probni zadatak (bez ocjene)" box of the form (WEB-1901): ticked only for a practice assignment. */
export function PracticeField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Checkbox label={f.practice.label} checked={checked} hint={checked ? f.practice.hint : f.practice.off}
      onChange={(event) => onChange(event.target.checked)} />
  );
}

/**
 * The same box on the edit page, read back from `institution.assignment.get` (PIL-D1-POLJE). The version route has no
 * `isPractice`, so a new version cannot change it: shown ticked or not, never as a working choice.
 */
export function PracticeReadBack({ current }: { current: { isPractice?: boolean } }) {
  const checked = practiceOf(current);
  return <Checkbox label={f.practice.label} checked={checked} disabled readOnly hint={f.practice.fixed} />;
}
