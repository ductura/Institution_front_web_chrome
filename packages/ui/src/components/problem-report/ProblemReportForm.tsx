"use client";

import type { FormEvent } from "react";

import { Button } from "../Button";
import { TextArea } from "../TextArea";
import styles from "./ProblemReportForm.module.css";

/** What the form shows: the host's model (formView) in this shape; every text arrives from the catalogue. */
export type ProblemReportFormView = {
  readonly categories: readonly { readonly value: string; readonly label: string; readonly who: string; readonly checked: boolean }[];
  readonly counter: string | null;
  readonly check: string | null;
  readonly alert: string | null;
  readonly status: string | null;
  readonly sent: readonly [string, string] | null;
  readonly ended: string | null;
  readonly button: { readonly label: string; readonly disabled: boolean } | null;
};

export type ProblemReportFormLabels = {
  readonly intro: string;
  readonly categoryLegend: string;
  readonly description: string;
  readonly attachedTitle: string;
  readonly attached: readonly string[];
  /** "Sadržaj Vašeg rada se ne šalje." */
  readonly noContent: string;
};

export type ProblemReportFormProps = {
  view: ProblemReportFormView;
  labels: ProblemReportFormLabels;
  description: string;
  onDescription: (value: string) => void;
  onCategory: (value: string) => void;
  onSubmit: () => void;
};

/**
 * "Prijavi problem" (WEB-1806, M11.10): a thin view over the host's model. It
 * has no field for the text of a work: a category and one description, with
 * the list of what goes with it and the line that the work's content does not.
 */
export function ProblemReportForm({ view, labels, description, onDescription, onCategory, onSubmit }: ProblemReportFormProps) {
  if (view.sent !== null) {
    return (
      <div className={styles.form} role="status">
        <p className={styles.strong}>{view.sent[0]}</p>
        <p>{view.sent[1]}</p>
      </div>
    );
  }
  if (view.ended !== null) return <p className={styles.form} role="alert">{view.ended}</p>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p>{labels.intro}</p>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{labels.categoryLegend}</legend>
        {view.categories.map((category) => (
          <label key={category.value} className={styles.option}>
            <input type="radio" name="problem-category" value={category.value} checked={category.checked}
              onChange={() => onCategory(category.value)} />
            <span><span className={styles.strong}>{category.label}</span><span className={styles.who}>{category.who}</span></span>
          </label>
        ))}
      </fieldset>
      <TextArea label={labels.description} value={description} rows={5} onChange={(event) => onDescription(event.target.value)}
        hint={view.counter ?? undefined} error={view.check ?? undefined} />
      <div className={styles.attached}>
        <p className={styles.strong}>{labels.attachedTitle}</p>
        <ul>{labels.attached.map((line) => <li key={line}>{line}</li>)}</ul>
        <p>{labels.noContent}</p>
      </div>
      {view.alert !== null ? <p role="alert" className={styles.alert}>{view.alert}</p> : null}
      {view.status !== null ? <p role="status">{view.status}</p> : null}
      {view.button !== null ? <Button type="submit" disabled={view.button.disabled}>{view.button.label}</Button> : null}
    </form>
  );
}
