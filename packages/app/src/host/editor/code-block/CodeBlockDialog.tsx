"use client";

// WEB-V21-STEM-KOD-BLOK: dijalog „Blok koda”: jezik s popisa i naslov ispisa (do 300 znakova). Rezultat izlazi
// kroz `onConfirm`; dijalog ne dira dokument. Kod se samo uređuje kao tekst, nikad se ne izvršava.
import { Button, Dialog, Select, TextField } from "@ductura/ui";
import { useEffect, useState } from "react";

import { tidyCaption, validCodeBlockProps, type CodeBlockProps } from "./code-commands.ts";
import { CODE_LANGUAGES, MAX_CODE_CAPTION_CODE_POINTS, isCodeLanguage } from "./highlight.ts";
import { codeBlockHr as t } from "./messages.hr.ts";

export type CodeBlockDialogProps = {
  open: boolean;
  initial?: CodeBlockProps | null;
  /** Vrati false kad editor odbije vrijednosti: dijalog ostaje otvoren i zadržava unos. */
  onConfirm: (result: CodeBlockProps) => boolean | void;
  onClose: () => void;
};

export function CodeBlockDialog({ open, initial, onConfirm, onClose }: CodeBlockDialogProps) {
  const [language, setLanguage] = useState<string>(initial?.language ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (open) { setLanguage(initial?.language ?? ""); setCaption(initial?.caption ?? ""); setRefused(false); }
  }, [open, initial?.language, initial?.caption]);

  const length = Array.from(tidyCaption(caption) ?? "").length;
  const result: CodeBlockProps = { language: isCodeLanguage(language) ? language : null, caption: tidyCaption(caption) };
  const canConfirm = validCodeBlockProps(result);
  const message = refused ? t.refused : length > MAX_CODE_CAPTION_CODE_POINTS ? t.captionTooLong(length, MAX_CODE_CAPTION_CODE_POINTS) : undefined;
  const confirm = () => { if (canConfirm && onConfirm(result) === false) setRefused(true); };

  return (
    <Dialog open={open} title={t.dialogTitle} onClose={onClose} error={message}
      actions={<>
        <Button type="button" tone="quiet" onClick={onClose}>{t.cancel}</Button>
        <Button type="button" disabled={!canConfirm} onClick={confirm}>{t.confirm}</Button>
      </>}>
      <p>{t.dialogHint}</p>
      <Select label={t.language} value={language} placeholder={t.languageNone}
        options={CODE_LANGUAGES.map((value) => ({ value, label: t.languageNames[value] }))}
        onChange={(event) => { setLanguage(event.target.value); setRefused(false); }} />
      <TextField label={t.caption} value={caption} hint={t.captionCounter(length, MAX_CODE_CAPTION_CODE_POINTS)}
        onChange={(event) => { setCaption(event.target.value); setRefused(false); }} />
    </Dialog>
  );
}
