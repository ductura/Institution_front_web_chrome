"use client";

import { OptionGroup } from "@ductura/ui";

import { assignmentFormHr as f } from "./messages.hr";
import type { RuleChoices } from "./rules";

const sr = f.submitRules;

type Shown = Pick<RuleChoices, "withdrawal" | "declarationRequired"> & { readonly lateAllowed?: boolean };

/** The line "Student na koraku predaje vidi: …" (prototype), from the switches whose value is known here. */
export function seesLine(choices: Shown): string {
  const parts = [
    ...(choices.lateAllowed === undefined ? [] : [sr.seesLate[choices.lateAllowed ? "on" : "off"]]),
    sr.seesWithdrawal[choices.withdrawal ? "on" : "off"],
    sr.seesDeclaration[choices.declarationRequired ? "on" : "off"],
  ];
  return `${sr.seesIntro} ${parts.join("; ")}.`;
}

/**
 * Section zs-5 "Pravila predaje" (NZ-4): (a) late submission, (b) withdrawal, (c) declaration required.
 * (a) is a working choice where its value is known (the new assignment, F4-NAS-R01); without `lateAllowed`
 * (the edit page, where the teacher has no route to read it) it is shown disabled and honest.
 * `prefix` keeps the field names apart when the same block stands on the edit page.
 */
export function SubmissionRules({ value, onChange, disabled = false, prefix = "pr" }: {
  value: Shown;
  onChange: (next: Partial<Pick<RuleChoices, "withdrawal" | "declarationRequired" | "lateAllowed">>) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  const late = value.lateAllowed;
  return (
    <>
      {late === undefined ? (
        <>
          <OptionGroup legend={sr.lateLegend} name={`${prefix}-late`} value="" disabled
            options={[{ value: "yes", label: sr.lateAllowed }, { value: "no", label: sr.lateDenied }]} />
          <p className="meta">{sr.lateUnavailable}</p>
        </>
      ) : (
        <OptionGroup legend={sr.lateLegend} name={`${prefix}-late`} value={late ? "yes" : "no"} disabled={disabled}
          options={[{ value: "yes", label: sr.lateAllowed }, { value: "no", label: sr.lateDenied }]}
          onChange={(next) => onChange({ lateAllowed: next === "yes" })} />
      )}
      <OptionGroup legend={sr.withdrawalLegend} name={`${prefix}-withdrawal`} value={value.withdrawal ? "on" : "off"} disabled={disabled}
        options={[{ value: "on", label: sr.withdrawalOn }, { value: "off", label: sr.withdrawalOff }]}
        onChange={(next) => onChange({ withdrawal: next === "on" })} />
      <OptionGroup legend={sr.declarationLegend} name={`${prefix}-declaration`} value={value.declarationRequired ? "on" : "off"} disabled={disabled}
        options={[{ value: "on", label: sr.declarationOn }, { value: "off", label: sr.declarationOff }]}
        onChange={(next) => onChange({ declarationRequired: next === "on" })} />
      <p className="note" aria-live="polite">{seesLine(value)}</p>
    </>
  );
}
