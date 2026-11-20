"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Button } from "../Button";
import { Select } from "../Select";
import { TextField } from "../TextField";
import { Popover } from "../popover";
import { sourceFormHr as t } from "./messages.hr";
import { fieldsByType, isRequired, readSource, sourceTypes, type SourceAuthor, type SourceDraft, type SourceType } from "./source-fields";
import styles from "./SourceForm.module.css";

export type SourceFormAction = "save" | "cite";
export type SourceFormProps = {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (source: SourceDraft, action: SourceFormAction) => void;
  /** Seed for a new opening or an edit. Remount to replace the draft while open. */
  initial?: SourceDraft;
  editing?: boolean;
  allowCite?: boolean;
  pending?: boolean;
  disabled?: boolean;
  error?: string;
  floating?: boolean;
};

type Errors = Record<string, string>;
const typeOptions = sourceTypes.map((value) => ({ value, label: t[value] }));
const authorOptions = ["person", "organization"].map((value) => ({ value, label: value === "person" ? t.person : t.organization }));

function Contributor({ prefix, editor, initial, errors }: { prefix: string; editor: boolean; initial?: SourceAuthor; errors: Errors }) {
  const [kind, setKind] = useState(initial?.kind ?? "person");
  const fields = kind === "person" ? ["family", "given"] as const : ["name", "acronym"] as const;
  const values: Partial<Record<typeof fields[number], string>> = initial?.kind === kind ? initial : {};
  return <>
    {!editor && <Select name={`${prefix}.kind`} label={t.contributorType} options={authorOptions} value={kind}
      onChange={(event) => setKind(event.currentTarget.value === "organization" ? "organization" : "person")} />}
    {fields.map((field) => (
      <TextField key={field} label={t[field]} name={`${prefix}.${field}`} required={isRequired(field)}
        defaultValue={values[field]} error={errors[`${prefix}.${field}`]} />
    ))}
  </>;
}

function Contributors({ editor = false, initial = [], errors, clearErrors }: {
  editor?: boolean; initial?: SourceAuthor[]; errors: Errors; clearErrors: () => void;
}) {
  const [rows, setRows] = useState(() => initial.length ? initial.map((_, id) => id) : [0]);
  const nextId = useRef(rows.length);
  const group = editor ? "editors" : "authors";
  return (
    <fieldset className={styles.group}>
      <legend>{t[group]}</legend>
      {rows.map((id, index) => (
        <fieldset key={id} className={styles.group}>
          <legend>{editor ? t.editor : t.author} {index + 1}</legend>
          <Contributor prefix={`${group}.${index}`} editor={editor} initial={initial[id]} errors={errors} />
          {rows.length > 1 && <Button tone="quiet" aria-label={`${t.remove} – ${editor ? t.editor : t.author} ${index + 1}`}
            onClick={() => { setRows(rows.filter((row) => row !== id)); clearErrors(); }}>{t.remove}</Button>}
        </fieldset>
      ))}
      <Button tone="quiet" disabled={rows.length >= (editor ? 20 : 50)} onClick={() => setRows([...rows, nextId.current++])}>
        {editor ? t.addEditor : t.addAuthor}
      </Button>
    </fieldset>
  );
}

function SourceFields({ anchor, floating, initial, editing, allowCite, pending, disabled, error, onClose, onSubmit }: SourceFormProps) {
  const [type, setType] = useState<SourceType>(initial?.type ?? "book");
  const [errors, setErrors] = useState<Errors>({});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!floating) return;
    const frame = requestAnimationFrame(() => form.current?.querySelector("select")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [floating]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    const result = readSource(type, new FormData(event.currentTarget));
    setErrors(result.errors ?? {});
    if (result.draft) {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      onSubmit(result.draft, submitter?.getAttribute("value") === "cite" ? "cite" : "save");
    } else requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  const initialFields: Partial<Record<(typeof fieldsByType)[SourceType][number], string>> = initial?.type === type ? initial : {};
  return (
    <form ref={form} noValidate onSubmit={submit} className={styles.form} aria-busy={pending || undefined}>
      <fieldset className={styles.fields} disabled={pending || disabled}>
        <Select label={t.type} value={type} options={typeOptions} onChange={(event) => {
          setType(event.currentTarget.value as SourceType);
          setErrors({});
        }} />
        <TextField label={t.title} name="title" required defaultValue={initial?.title} error={errors.title} />
        <TextField label={t.year} name="year" required inputMode="numeric" defaultValue={initial?.year} error={errors.year} />
        <Contributors initial={initial?.authors} errors={errors} clearErrors={() => setErrors({})} />
        <div key={type} className={styles.fields}>
          {fieldsByType[type].map((field) => (
            <TextField key={field} label={t[field]} name={field} required={isRequired(field)} defaultValue={initialFields[field]}
              inputMode={field === "url" ? "url" : undefined} hint={field === "accessed" ? t.dateHint : undefined} error={errors[field]} />
          ))}
          {type === "chapter" && <Contributors editor initial={initial?.type === "chapter" ? initial.editors : undefined}
            errors={errors} clearErrors={() => setErrors({})} />}
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button tone="quiet" onClick={() => { anchor.current?.focus(); onClose(); }}>{t.cancel}</Button>
        <Button type="submit" disabled={disabled || pending}>{editing ? t.save : allowCite ? t.library : t.add}</Button>
        {!editing && allowCite && <Button type="submit" value="cite" disabled={disabled || pending}>{t.cite}</Button>}
      </div>
    </form>
  );
}

export function SourceForm({ floating = true, ...props }: SourceFormProps) {
  return (
    <Popover open={props.open} anchor={props.anchor} label={props.editing ? t.edit : t.add} onClose={props.onClose} floating={floating}>
      <SourceFields {...props} floating={floating} />
    </Popover>
  );
}
