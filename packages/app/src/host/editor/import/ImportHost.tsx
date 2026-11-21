"use client";

// WEB-1801 (M8.2, S-19): the student's import of a DOCX or PDF. The button is
// drawn only when the teacher allowed import for the assignment; the file goes
// to the server through src/client/import, the student reads the preview and
// confirms with the declaration, and only then does the text count as imported.
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Dialog } from "@ductura/ui";

import {
  confirmImport, previewImport, readImportPermission, type ImportConfirmed, type ImportPermission, type ImportTransport,
} from "../../../../../../src/client/import.ts";

import { afterConfirm, afterPreview, canConfirm, declare, showImportButton, START, type ImportState } from "./import-model";
import { importHostHr as t } from "./messages.hr";

type Props = {
  assignmentId: string;
  transport: ImportTransport;
  /** Called once with the server's import event; the work marks the text as imported. */
  onConfirmed?: (confirmed: ImportConfirmed) => void;
};

export function ImportHost({ assignmentId, transport, onConfirmed }: Props) {
  const [permission, setPermission] = useState<ImportPermission | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>(START);
  /** Id of the latest file choice; a slower older preview is ignored. */
  const latest = useRef(0);

  useEffect(() => {
    let live = true;
    void readImportPermission(assignmentId, transport).then((read) => { if (live) setPermission(read); });
    return () => { live = false; };
  }, [assignmentId, transport]);

  if (!showImportButton(permission)) return null;

  const close = () => { latest.current += 1; setOpen(false); setState(START); };
  const choose = async (file: File | undefined) => {
    if (!file) return;
    const mine = ++latest.current;
    setState({ step: "reading" });
    const result = await previewImport(assignmentId, file, transport);
    if (mine === latest.current) setState(afterPreview(result));
  };
  const confirm = async () => {
    if (!canConfirm(state)) return;
    const pending: ImportState = { step: "confirming", preview: state.preview };
    const mine = ++latest.current;
    setState(pending);
    const result = await confirmImport(assignmentId, state.preview.previewId, state.declared, transport);
    if (mine !== latest.current) return;
    if (result.kind === "confirmed") onConfirmed?.(result.confirmed);
    setState(afterConfirm(pending, result));
  };

  const preview = state.step === "preview" || state.step === "confirming" ? state.preview : null;
  return (
    <>
      <Button tone="quiet" onClick={() => setOpen(true)}>{t.open}</Button>
      {open && (
        <Dialog open title={t.title} onClose={close} actions={state.step === "done"
          ? <Button onClick={close}>{t.close}</Button>
          : <>
            <Button tone="quiet" onClick={close}>{t.cancel}</Button>
            <Button disabled={!canConfirm(state)} busy={state.step === "confirming"} onClick={() => void confirm()}>
              {state.step === "confirming" ? t.confirming : t.confirm}
            </Button>
          </>}>
          {state.step === "done" ? <p role="status">{t.done(state.confirmed.words)}</p> : <>
            <p>{t.note}</p>
            <label>{t.file} <input type="file" accept=".docx,.pdf" disabled={state.step === "reading" || state.step === "confirming"}
              onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} /></label>
            {state.step === "reading" && <p role="status">{t.reading}</p>}
            {preview && <section aria-labelledby="uvoz-pregled">
              <h3 id="uvoz-pregled">{t.previewHeading}</h3>
              <p>{t.previewWords(preview.words)} · <em data-import-mark="">{t.mark}</em></p>
              <div tabIndex={0} role="region" aria-label={t.previewHeading}>
                {preview.paragraphs.map((text, index) => <p key={index}>{text}</p>)}
              </div>
              <Checkbox label={t.declaration} checked={state.step === "preview" && state.declared}
                disabled={state.step === "confirming"} onChange={(event) => setState(declare(state, event.target.checked))} />
            </section>}
            <p role="alert">{"error" in state ? state.error : ""}</p>
          </>}
        </Dialog>
      )}
    </>
  );
}
