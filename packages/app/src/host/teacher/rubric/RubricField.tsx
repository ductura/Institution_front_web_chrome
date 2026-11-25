"use client";

import { Button, FormSection as Section, TextArea, TextField } from "@ductura/ui";

import { rubricFormHr as t } from "./messages.hr";
import {
  addCriterion, LEVEL_COUNT, MAX_CRITERIA, MAX_DESCRIPTOR, MAX_LABEL, MAX_TITLE, removeCriterion, setLevel, setTitle,
  type Rubric, type RubricErrors,
} from "./rubric-model";

const message = (kind: "required" | "too-long" | undefined, max: number) =>
  kind === undefined ? {} : { error: kind === "required" ? t.required : t.tooLong(max) };

/** The assignment form's rubric section: controlled, it only reports the edited list; saving is the form's step after publishing. */
export function RubricField({ value, onChange, errors }: { value: Rubric; onChange: (next: Rubric) => void; errors?: RubricErrors }) {
  const fields = errors?.fields ?? {};
  return (
    <Section id="zs-rubric" title={t.heading}>
      <p className="note">{t.note}</p>
      {value.length === 0 && <p className="meta">{t.empty}</p>}
      {value.map((criterion, i) => (
        <fieldset key={criterion.id} className="card">
          <legend>{t.criterion(i + 1)}</legend>
          <TextField label={t.title} value={criterion.title} maxLength={MAX_TITLE} autoComplete="off"
            {...message(fields[`${i}.title`], MAX_TITLE)} onChange={(event) => onChange(setTitle(value, i, event.target.value))} />
          {Array.from({ length: LEVEL_COUNT }, (_, j) => (
            <fieldset key={j}>
              <legend>{t.level(j + 1)}</legend>
              <TextField label={`${t.label} (${t.criterion(i + 1)}, ${t.level(j + 1)})`} value={criterion.levels[j]!.label} maxLength={MAX_LABEL} autoComplete="off"
                {...message(fields[`${i}.label${j}`], MAX_LABEL)} onChange={(event) => onChange(setLevel(value, i, j, { label: event.target.value }))} />
              <TextArea label={`${t.descriptor} (${t.criterion(i + 1)}, ${t.level(j + 1)})`} rows={2} value={criterion.levels[j]!.descriptor} maxLength={MAX_DESCRIPTOR}
                {...message(fields[`${i}.descriptor${j}`], MAX_DESCRIPTOR)} onChange={(event) => onChange(setLevel(value, i, j, { descriptor: event.target.value }))} />
            </fieldset>
          ))}
          <Button type="button" tone="secondary" aria-label={t.remove(i + 1)} onClick={() => onChange(removeCriterion(value, i))}>{t.remove(i + 1)}</Button>
        </fieldset>
      ))}
      <Button type="button" tone="secondary" disabled={value.length >= MAX_CRITERIA} onClick={() => onChange(addCriterion(value))}>{t.add}</Button>
      {value.length >= MAX_CRITERIA && <p className="meta">{t.limit}</p>}
    </Section>
  );
}
