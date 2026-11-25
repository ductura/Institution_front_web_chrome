"use client";

// ED-20 (NF2-P19, WEB-1801): "Uvezi tekst iz datoteke". The file goes to the
// server through the client's previewImport, the student reads the preview,
// and only "Potvrdi uvoz" (confirmImport) puts the text
// at the end of the work. The button is there only while the work can be edited.
import { useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { confirmImport, previewImport } from "../../../../../../src/client/import.ts";

import { afterConfirm, afterNotebook, afterPreview, editorContent, notebookContent, START, type ImportState } from "./import-model";
import { ipynbHr } from "./ipynb/messages.hr";
import { IPYNB_MAX_BYTES } from "./ipynb/parse";
import { importHostHr as t } from "./messages.hr";

/** The file as text; null when it cannot be read. (jsdom's File has no `text()`, so FileReader is the fallback.) */
const readText = (file: Blob): Promise<string | null> =>
  typeof file.text === "function" ? file.text().catch(() => null) : new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });

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
    if (/\.ipynb$/i.test(file.name)) {
      // A notebook is read here, as text, and is never run; there is no server call for it.
      const text = file.size > IPYNB_MAX_BYTES ? "" : await readText(file);
      if (mine !== latest.current) return;
      return setState(text === null ? { step: "choose", error: ipynbHr.refused.unreadable } : file.size > IPYNB_MAX_BYTES ? { step: "choose", error: ipynbHr.refused.tooLarge } : afterNotebook(file.name, text));
    }
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

  const confirmNotebook = () => {
    if (state.step !== "notebook") return;
    // The text carries the `imported` mark and code needs `codeBlock`; both exist only in the v4 schema.
    const schema = (editor as { schema?: { nodes?: Record<string, unknown>; marks?: Record<string, unknown> } }).schema;
    const needsCode = state.blocks.some((block) => block.type === "codeBlock");
    if (!schema?.marks?.imported || (needsCode && !schema.nodes?.codeBlock)) return setState({ ...state, error: ipynbHr.refused.noCodeBlocks });
    if (editor.isDestroyed || !editor.isEditable || !editor.chain().focus("end").insertContent(notebookContent(state.blocks)).run()) return setState({ ...state, error: ipynbHr.refused.insertFailed });
    setDone(ipynbHr.done(state.blocks.length, state.discarded));
    setOpen(false);
    setState(START);
  };

  const preview = state.step === "preview" || state.step === "confirming" ? state.preview : null;
  const error = "error" in state ? state.error ?? "" : "";
  const actions = state.step === "notebook"
    ? <>
      <Button tone="quiet" onClick={close}>{t.cancel}</Button>
      <Button onClick={confirmNotebook}>{t.confirm}</Button>
    </>
    : preview
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
          {state.step === "notebook" ? <>
            <section aria-labelledby="uvoz-pregled" data-import-preview="">
              <h3 id="uvoz-pregled">{t.previewHeading}</h3>
              <p>{ipynbHr.previewMeta(state.fileName, state.blocks.length)}</p>
              {state.discarded > 0 && <p>{ipynbHr.discarded(state.discarded)}</p>}
              <div tabIndex={0} role="region" aria-label={t.previewHeading}>
                {state.blocks.map((block, index) => block.type === "codeBlock"
                  ? <pre key={index}>{block.caption ? `${block.caption}\n` : ""}{block.text}</pre>
                  : <p key={index}>{block.text}</p>)}
              </div>
            </section>
            <p role="status">{t.waiting}</p>
          </> : preview ? <>
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
            <input ref={input} id="uvoz-datoteka" type="file" accept=".docx,.pdf,.ipynb" aria-describedby="uvoz-greska" />
            <p>{ipynbHr.hint}</p>
          </>}
          <p id="uvoz-greska" role="alert">{error}</p>
        </Dialog>
      )}
    </>
  );
}
