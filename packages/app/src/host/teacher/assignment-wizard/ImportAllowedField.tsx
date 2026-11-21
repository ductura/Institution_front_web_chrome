"use client";

import { Checkbox } from "@ductura/ui";

import { importAllowedHr as t } from "./messages.hr";

/** The wizard's step-3 field. It only reports the choice; the draft and its default (off) belong to TeacherSetup. */
export function ImportAllowedField({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <>
      <Checkbox label={t.label} checked={value} onChange={(event) => onChange(event.target.checked)} />
      <p>{value ? t.hint : t.off}</p>
    </>
  );
}
