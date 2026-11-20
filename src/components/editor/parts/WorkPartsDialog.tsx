"use client";

import { useState } from "react";
import { Button, Checkbox, Dialog, TextArea } from "@ductura/ui";

import { workPartsMessages as t } from "./messages.hr";

type TextPart = { readonly enabled: boolean; readonly text: string };
export type WorkParts = {
  readonly declaration: TextPart;
  readonly acknowledgments: TextPart;
  readonly abbreviations: boolean;
  readonly romanNumerals: boolean;
  readonly endnotes: boolean;
  readonly index: boolean;
  readonly biography: TextPart;
};

type WorkPartsDialogProps = {
  value: WorkParts;
  declarationTemplate?: string;
  onApply: (parts: WorkParts) => boolean;
  onClose: () => void;
};

/** Mount on opening. Edits remain a draft until the work accepts the whole change. */
export function WorkPartsDialog({ value, declarationTemplate, onApply, onClose }: WorkPartsDialogProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();

  function update<Key extends keyof WorkParts>(key: Key, next: WorkParts[Key]) {
    setDraft((previous) => ({ ...previous, [key]: next }));
    setError(undefined);
  }

  function textPart(
    key: "declaration" | "acknowledgments" | "biography",
    label: string,
    textLabel: string,
    template?: string,
  ) {
    const part = draft[key];
    return <>
      <Checkbox label={label} checked={part.enabled}
        onChange={(event) => update(key, { ...part, enabled: event.target.checked })} />
      {part.enabled && <TextArea label={textLabel} value={part.text} placeholder={template}
        hint={template ? t.declarationHint : undefined}
        onChange={(event) => update(key, { ...part, text: event.target.value })} />}
    </>;
  }

  function toggle(key: "abbreviations" | "romanNumerals" | "endnotes" | "index") {
    return <Checkbox label={t[key]} checked={draft[key]} onChange={(event) => update(key, event.target.checked)} />;
  }

  return (
    <Dialog open title={t.title} error={error} onClose={onClose} actions={<>
      <Button tone="quiet" onClick={onClose}>{t.cancel}</Button>
      <Button onClick={() => { if (onApply(draft)) onClose(); else setError(t.applyError); }}>{t.done}</Button>
    </>}>
      <h3>{t.front}</h3>
      <p>{t.frontHint}</p>
      {textPart("declaration", t.declaration, t.declarationText, declarationTemplate)}
      {textPart("acknowledgments", t.acknowledgments, t.acknowledgmentsText)}
      {toggle("abbreviations")}
      {toggle("romanNumerals")}
      <h3>{t.back}</h3>
      {toggle("endnotes")}
      {toggle("index")}
      {textPart("biography", t.biography, t.biographyText)}
    </Dialog>
  );
}
