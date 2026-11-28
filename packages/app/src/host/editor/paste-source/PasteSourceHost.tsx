"use client";

// ED-76: "Prepoznat izvor" on paste (prototype features.js `X.hooks.paste`). The host listens to the
// paste on the writable editor without changing it; a paste of eight words or more is compared with
// the quotes of the source notebook, read at that moment over the existing per-source route. A match
// offers "Dodaj navod": the citation of that source, with the note's page, right after the pasted
// text. The offer lapses as soon as the text changes again, so the citation never lands elsewhere.
import { Button } from "@ductura/ui";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

import { useLocalEditor } from "@/components/editor/LocalDocument";
import { documentSources } from "@/components/editor/sources/proofs/proof-sources";
import type { readSourceNotes } from "@/client/source-notebook";

import { loadNotebook } from "../source-notebook/notebook";
import { pasteSourceHr as t } from "./messages.hr";
import { citeAfterPaste, MIN_WORDS, recognizePaste, wordCount, type Recognised } from "./paste-source";
import styles from "./PasteSource.module.css";

type Offer = { readonly found: Recognised; readonly at: number; readonly doc: unknown };
type Read = typeof readSourceNotes;

export function PasteSourceHost({ documentId }: { documentId: string }) {
  const editor = useLocalEditor();
  return editor ? <PasteSource editor={editor} documentId={documentId} /> : null;
}

export function PasteSource({ editor, documentId, read }: { editor: Editor; documentId: string; read?: Read }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [note, setNote] = useState<"added" | "failed" | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    let controller: AbortController | null = null;
    const dom = editor.view.dom;
    const onPaste = (event: ClipboardEvent) => {
      const pasted = event.clipboardData?.getData("text/plain") ?? "";
      if (!editor.isEditable || wordCount(pasted) < MIN_WORDS) return;
      const sources = documentSources(editor.getJSON() as Parameters<typeof documentSources>[0]);
      if (sources.length === 0) return;
      controller?.abort();
      const own = (controller = new AbortController());
      // The editor applies the paste in this same event; its result is read after it.
      void Promise.resolve().then(async () => {
        const at = editor.state.selection.to;
        const doc = editor.state.doc;
        const notes = await loadNotebook(documentId, sources, own.signal, read).catch(() => null);
        if (own.signal.aborted || !live.current || notes?.kind !== "ready") return;
        const found = recognizePaste(notes.entries, pasted);
        // Something was typed while the notebook was read: the place after the paste is no longer sure.
        if (found === null || editor.isDestroyed || editor.state.doc !== doc) return;
        setNote(null);
        setOffer({ found, at, doc });
      });
    };
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setOffer((o) => (o !== null && editor.state.doc !== o.doc ? null : o));
    };
    dom.addEventListener("paste", onPaste);
    editor.on("update", onUpdate);
    return () => {
      live.current = false;
      controller?.abort();
      dom.removeEventListener("paste", onPaste);
      editor.off("update", onUpdate);
    };
  }, [editor, documentId, read]);

  const add = () => {
    if (offer === null) return;
    const tr = !editor.isDestroyed && editor.isEditable && editor.state.doc === offer.doc
      ? citeAfterPaste(editor.state, offer.at, offer.found) : null;
    setOffer(null);
    if (tr === null) return setNote("failed");
    editor.view.dispatch(tr);
    editor.commands.focus();
    setNote("added");
  };

  if (offer === null) {
    return note === null ? null : (
      <p className={styles.note} role={note === "added" ? "status" : "alert"}>{t[note]}</p>
    );
  }
  return (
    <div className={styles.banner} role="status" data-paste-source="">
      <span><b>{t.found}</b> {t.source(offer.found.label, offer.found.page)}</span>
      <span className={styles.why}>{t.why}</span>
      <span className={styles.grow} />
      <Button size="dense" onClick={add}>{t.add}</Button>
      <Button tone="quiet" size="dense" onClick={() => setOffer(null)}>{t.close}</Button>
    </div>
  );
}
