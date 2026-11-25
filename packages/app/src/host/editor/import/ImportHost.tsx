"use client";

// ED-20 (NF2-P19, WEB-1801): "Uvezi tekst iz datoteke". The file goes to the
// server through the client's previewImport, the student reads the preview,
// and only "Potvrdi uvoz" (confirmImport) puts the text
// at the end of the work. The button is there only while the work can be edited.
import { useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { confirmImport, previewImport } from "../../../../../../src/client/import.ts";

import { afterConfirm, afterPreview, editorContent, START, type ImportState } from "./import-model";
import { importHostHr as t } from "./messages.hr";

type Api = NonNullable<Parameters<typeof previewImport>[2]>;
type Props = { documentId: string; api?: Api };

export function ImportHost({ documentId, api }: Props) {
  const editor = useLocalEditor();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>(START);
  const [done, setDone] = useState("");
  const input = useRef<HTMLInputElement>(null);
  /** Id of the latest request; an answer to an older one is ignored. */
  const latest = useRef(0);

  if (documentId === "" || !editor || editor.isDestroyed || !editor.isEditable) return null;

  const close = () => { latest.current += 1; setOpen(false); setState(START); };
  const run = async () => {
    const file = input.current?.files?.[0];
    if (!file) return setState({ step: "choose", error: t.noFile });
    if (typeof navigator !== "undefined" && navigator.onLine === false) return setState({ step: "choose", error: t.offline });
    const mine = ++latest.current;
    setState({ step: "reading" });
    const result = await previewImport(documentId, file, api);
    if (mine === latest.current) setState(afterPreview(result));
  };
  const confirm = async () => {
    if (state.step !== "preview") return;
    const pending: ImportState = { step: "confirming", preview: state.preview };
    const mine = ++latest.current;
    setState(pending);
    const result = await confirmImport(documentId, state.preview, api);
    if (mine !== latest.current) return;
    const next = afterConfirm(pending, result);
    if (next.step === "done") {
      if (!editor.isDestroyed && editor.isEditable) editor.chain().focus("end").insertContent(editorContent(state.preview.blocks)).run();
      setDone(t.done(next.words));
      setOpen(false);
      setState(START);
      return;
    }
    setState(next);
  };

  const preview = state.step === "preview" || state.step === "confirming" ? state.preview : null;
  const error = "error" in state ? state.error ?? "" : "";
  const actions = preview
    ? <>
      <Button tone="quiet" onClick={close}>{t.cancel}</Button>
      <Button busy={state.step === "confirming"} disabled={state.step === "confirming"} onClick={() => void confirm()}>
        {state.step === "confirming" ? t.confirming : t.confirm}
      </Button>
    </>
    : state.step === "reading"
      ? <Button tone="quiet" onClick={close}>{t.cancel}</Button>
      : <>
        <Button tone="quiet" onClick={close}>{t.close}</Button>
        <Button onClick={() => void run()}>{t.run}</Button>
      </>;
  return (
    <>
      <Button tone="quiet" aria-haspopup="dialog" onClick={() => { setDone(""); setOpen(true); }}>{t.open}</Button>
      <span role="status" className="sr-only">{done}</span>
      {open && (
        <Dialog open title={t.title} onClose={close} actions={actions}>
          <p>{t.note}</p>
          {preview ? <>
            <section aria-labelledby="uvoz-pregled" data-import-preview="">
              <h3 id="uvoz-pregled">{t.previewHeading}</h3>
              <p>{t.previewMeta(preview.fileName ?? preview.format.toUpperCase(), preview.words)}</p>
              <div tabIndex={0} role="region" aria-label={t.previewHeading}>
                {preview.blocks.map((block, index) => <p key={index}>{block.children.map((child) => child.text).join("")}</p>)}
              </div>
            </section>
            <p role="status">{t.waiting}</p>
          </> : state.step === "reading" ? <p role="status">{t.reading}</p> : <>
            <label htmlFor="uvoz-datoteka">{t.file}</label>
            <input ref={input} id="uvoz-datoteka" type="file" accept=".docx,.pdf" aria-describedby="uvoz-greska" />
          </>}
          <p id="uvoz-greska" role="alert">{error}</p>
        </Dialog>
      )}
    </>
  );
}
