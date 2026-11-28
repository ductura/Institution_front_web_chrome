"use client";

// ED-108: "Zalijepljeno. Što je ovo?" (prototype toolbar2.js `X.hooks.paste`). After a paste of a few
// words in one block the host asks what the text is: a literal quote (Croatian quotes, then @ for the
// source), a note to a source (saved over the existing per-source notes route and taken out of the
// work), something to set aside (the left panel's stash on this device) or text that stays. The offer
// lapses as soon as the text changes again, so no action lands on another place.
import { Button } from "@ductura/ui";
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

import { useLocalEditor } from "@/components/editor/LocalDocument";
import { documentSources, type ProofSource } from "@/components/editor/sources/proofs/proof-sources";
import { createSourceNote } from "@/client/source-notebook";

import { announceDeviceChange } from "../left/use-left";
import { storageKey } from "../left/left-model";
import { pasteWhatHr as t } from "./messages.hr";
import { MIN_PASTE_WORDS, pastedRange, pastedText, quotePasted, removePasted, stashText, wordCount, type PastedRange } from "./paste-what";
import styles from "./PasteWhat.module.css";

type Offer = { readonly range: PastedRange; readonly text: string; readonly doc: unknown };
type Note = keyof Pick<typeof t, "quoted" | "stashed" | "noted" | "notedKept" | "noSources" | "failed" | "stashFailed" | "stale">;
type Create = typeof createSourceNote;

const OK: ReadonlySet<Note> = new Set(["quoted", "stashed", "noted", "notedKept"]);
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function PasteWhatHost({ documentId, workId }: { documentId: string; workId: string }) {
  const editor = useLocalEditor();
  return editor ? <PasteWhat editor={editor} documentId={documentId} workId={workId} /> : null;
}

export function PasteWhat({ editor, documentId, workId, create = createSourceNote }: {
  editor: Editor; documentId: string; workId: string; create?: Create;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [sources, setSources] = useState<readonly ProofSource[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    let live = true;
    const dom = editor.view.dom;
    const onPaste = (event: ClipboardEvent) => {
      const pasted = event.clipboardData?.getData("text/plain") ?? "";
      if (!editor.isEditable || wordCount(pasted) < MIN_PASTE_WORDS) return;
      const before = editor.state.selection.from;
      // The editor applies the paste in this same event; its result is read after it.
      void Promise.resolve().then(() => {
        if (!live || editor.isDestroyed) return;
        const range = pastedRange(editor.state, before);
        if (range === null) return;
        setNote(null);
        setSources(null);
        setOffer({ range, text: pastedText(editor.state, range), doc: editor.state.doc });
      });
    };
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setOffer((o) => (o !== null && editor.state.doc !== o.doc ? null : o));
    };
    // Capture: the start of the selection is read before the editor applies the paste.
    dom.addEventListener("paste", onPaste, true);
    editor.on("update", onUpdate);
    return () => {
      live = false;
      dom.removeEventListener("paste", onPaste, true);
      editor.off("update", onUpdate);
    };
  }, [editor]);

  /** The offer while the text is as it was after the paste, or null with the reason shown. */
  const current = (): Offer | null => {
    if (offer !== null && !editor.isDestroyed && editor.isEditable && editor.state.doc === offer.doc) return offer;
    setOffer(null);
    setNote("stale");
    return null;
  };
  const finish = (result: Note) => { setOffer(null); setSources(null); setNote(result); };

  const quote = () => {
    const o = current();
    if (o === null) return;
    editor.view.dispatch(quotePasted(editor.state, o.range));
    editor.commands.focus();
    finish("quoted");
  };
  const stash = () => {
    const o = current();
    if (o === null) return;
    if (stashText(storage(), workId, o.text, newId(), new Date().toISOString()) === null) return finish("stashFailed");
    announceDeviceChange(storageKey("stash", workId));
    editor.view.dispatch(removePasted(editor.state, o.range));
    editor.commands.focus();
    finish("stashed");
  };
  const askSource = () => {
    if (current() === null) return;
    const list = documentSources(editor.getJSON() as Parameters<typeof documentSources>[0]);
    if (list.length === 0) return finish("noSources");
    setSources(list);
  };
  const noteTo = async (sourceId: string) => {
    const o = current();
    if (o === null || busy) return;
    setBusy(true);
    const saved = await create(documentId, sourceId, { quote: o.text }).catch(() => null);
    setBusy(false);
    if (saved?.kind !== "ok") return setNote("failed");
    // The note is saved either way; the text leaves the work only if it is still the pasted one.
    if (editor.isDestroyed || !editor.isEditable || editor.state.doc !== o.doc) return finish("notedKept");
    editor.view.dispatch(removePasted(editor.state, o.range));
    editor.commands.focus();
    finish("noted");
  };

  if (offer === null) {
    return note === null ? null : <p className={styles.note} role={OK.has(note) ? "status" : "alert"}>{t[note]}</p>;
  }
  if (sources !== null) {
    return (
      <div className={styles.menu} role="group" aria-label={t.whichSource} data-paste-what="sources">
        <b>{t.whichSource}</b>
        {sources.map((s) => (
          <Button key={s.id} tone="quiet" size="dense" disabled={busy} onClick={() => void noteTo(s.id)}>{s.label}</Button>
        ))}
        {note === "failed" ? <p className={styles.note} role="alert">{t.failed}</p> : null}
        <span className={styles.row}>
          <Button tone="quiet" size="dense" onClick={() => setSources(null)}>{t.back}</Button>
        </span>
      </div>
    );
  }
  const item = (label: string, hint: string, onClick: () => void) => (
    <Button tone="quiet" size="dense" onClick={onClick}>{label} <span className={styles.hint}>{hint}</span></Button>
  );
  return (
    <div className={styles.menu} role="group" aria-label={t.title} data-paste-what="">
      <b>{t.title}</b>
      {item(t.quote, t.quoteHint, quote)}
      {item(t.note, t.noteHint, askSource)}
      {item(t.stash, t.stashHint, stash)}
      {item(t.keep, t.keepHint, () => setOffer(null))}
    </div>
  );
}
