"use client";

import { OptionGroup } from "@ductura/ui";

import { assignmentFormHr as f } from "./messages.hr";
import type { RuleChoices } from "./rules";

const sr = f.submitRules;

/** The line "Student na koraku predaje vidi: …" (prototype), from the two switches that exist. */
export function seesLine(choices: Pick<RuleChoices, "withdrawal" | "declarationRequired">): string {
  const parts = [sr.seesWithdrawal[choices.withdrawal ? "on" : "off"], sr.seesDeclaration[choices.declarationRequired ? "on" : "off"]];
  return `${sr.seesIntro} ${parts.join("; ")}.`;
}

/**
 * Section zs-5 "Pravila predaje" (NZ-4): (a) late submission, (b) withdrawal, (c) declaration required.
 * (a) has no field on the server yet, so it is shown, disabled and honest, never as a working choice.
 * `ids` keeps the field names apart when the same block stands on the edit page.
 */
export function SubmissionRules({ value, onChange, disabled = false, prefix = "pr" }: {
  value: Pick<RuleChoices, "withdrawal" | "declarationRequired">;
  onChange: (next: Partial<Pick<RuleChoices, "withdrawal" | "declarationRequired">>) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  return (
    <>
      <OptionGroup legend={sr.lateLegend} name={`${prefix}-late`} value="" disabled
        options={[{ value: "yes", label: sr.lateAllowed }, { value: "no", label: sr.lateDenied }]} />
      <p className="meta">{sr.lateUnavailable}</p>
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
