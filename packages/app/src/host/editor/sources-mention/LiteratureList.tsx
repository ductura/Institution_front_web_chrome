"use client";

import { Button, Dialog, SearchableList, SourceForm, type SourceDraft } from "@ductura/ui";
import type { Transaction } from "@tiptap/pm/state";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { useLocalEditor, useLocalSignedOut } from "@/components/editor/LocalDocument";
import SourceList from "@/components/editor/sources/panel/SourceList";
import { documentSources } from "@/components/editor/sources/proofs/proof-sources";
import { QuickSource } from "@/components/editor/sources/quick-source/QuickSource";
import {
  addSourceTransaction, citationCount, editSourceTransaction, jumpTo, linkPlaceTransaction, listedSources,
  placeExcerpt, plainCitationPlaces, removeSourceTransaction, sourceDraftOf,
} from "./mention-model";
import { sourcesMentionHr as t } from "./messages.hr";

type Doc = NonNullable<ReturnType<typeof useLocalEditor>>["state"]["doc"];
type Open = { kind: "link" | "add"; pos: number } | { kind: "edit"; id: string; draft: SourceDraft } | null;
type Notice = { alert: boolean; text: string } | null;

/** The document, read again after every transaction. */
function useDoc(): Doc | null {
  const editor = useLocalEditor();
  const last = useRef<Doc | null>(null);
  return useSyncExternalStore(
    (notify) => {
      editor?.on("transaction", notify);
      return () => { if (!editor?.isDestroyed) editor?.off("transaction", notify); };
    },
    () => {
      const doc = editor && !editor.isDestroyed ? editor.state.doc : null;
      if (doc !== last.current) last.current = doc;
      return last.current;
    },
    () => null,
  );
}

/**
 * "Literatura" of the sources card (PARITET E 2, INVENTAR §2.1 vSrc): "Navodi bez izvora (n)" with "Pokaži",
 * "Poveži s izvorom" and "Dodaj izvor", then the sources of the work, cited or not yet, with "Citiraj",
 * "Uredi" and "Ukloni". Only the author of a work that is still open edits; others only read.
 */
export function LiteratureList() {
  const editor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const doc = useDoc();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const json = useMemo(() => (doc ? doc.toJSON() : null), [doc]);
  const items = useMemo(() => listedSources(json), [json]);
  const choices = useMemo(() => documentSources(json), [json]);
  const places = useMemo(() => (doc ? plainCitationPlaces(doc) : []), [doc]);
  if (signedOut || !editor || !doc) return null;
  const editable = editor.isEditable;

  const apply = (build: () => Transaction | null | "limit", done: string) => {
    if (editor.isDestroyed || !editor.isEditable) return setNotice({ alert: true, text: t.addFailed });
    const tr = build();
    if (tr === "limit") return setNotice({ alert: true, text: t.limit });
    if (!tr) return setNotice({ alert: true, text: t.placeChanged });
    editor.view.dispatch(tr);
    setNotice({ alert: false, text: done });
    return true;
  };
  const close = () => setOpen(null);
  const trusted = (run: () => void) => (event: { isTrusted: boolean }) => { if (event.isTrusted) run(); };

  return <div ref={anchor}>
    {places.length > 0 && <section aria-label={t.plainHeading(places.length)}>
      <h3>{t.plainHeading(places.length)}</h3>
      <ul>
        {places.map((pos) => <li key={pos}>
          <p>{placeExcerpt(doc, pos)}</p>
          <Button tone="quiet" onClick={trusted(() => { editor.view.dispatch(jumpTo(editor.state, pos)); editor.commands.focus(); })}>{t.show}</Button>
          {editable && <>
            <Button tone="quiet" disabled={choices.length === 0} onClick={trusted(() => setOpen({ kind: "link", pos }))}>{t.link}</Button>
            <Button tone="quiet" onClick={trusted(() => setOpen({ kind: "add", pos }))}>{t.add}</Button>
          </>}
        </li>)}
      </ul>
    </section>}
    {items.length > 0 && <SourceList items={items} editable={editable}
      onCite={(item) => {
        if (editor.isDestroyed || !editor.isEditable) return;
        const range = citationRange(editor.state);
        const tr = range && insertCitation(editor.state, range, item.id, "");
        if (tr) { editor.view.dispatch(tr); editor.commands.focus(); }
      }}
      rowActions={(item) => editable && <>
        <Button tone="quiet" aria-label={`${t.edit}: ${item.entry}`} onClick={trusted(() => {
          const draft = sourceDraftOf(editor.state.doc.attrs.sources, item.id);
          if (draft) setOpen({ kind: "edit", id: item.id, draft });
          else setNotice({ alert: true, text: t.editUnavailable });
        })}>{t.edit}</Button>
        <Button tone="quiet" aria-label={`${t.remove}: ${item.entry}`} onClick={trusted(() => {
          const count = citationCount(editor.state.doc, item.id);
          if (count > 0 && confirm !== item.id) { setConfirm(item.id); return setNotice({ alert: false, text: t.removeConfirm(count) }); }
          setConfirm(null);
          apply(() => removeSourceTransaction(editor.state, item.id), count > 0 ? t.removedCited : t.removed);
        })}>{t.remove}</Button>
      </>} />}
    <p role={notice?.alert ? "alert" : "status"}>{notice?.text ?? ""}</p>

    <Dialog open={open?.kind === "link"} title={t.link} onClose={close}
      actions={<Button tone="quiet" onClick={close}>{t.cancel}</Button>}>
      {open?.kind === "link" && <SearchableList items={choices} emptyMessage={t.noSources} onSelect={(source) => {
        close();
        if (apply(() => linkPlaceTransaction(editor.state, open.pos, source.id), t.linked)) editor.commands.focus();
      }} />}
    </Dialog>
    <Dialog open={open?.kind === "add"} title={t.quickTitle} onClose={close}
      actions={<Button tone="quiet" onClick={close}>{t.cancel}</Button>}>
      {open?.kind === "add" && <QuickSource disabled={!editable} onSubmit={(draft) => {
        close();
        const id = crypto.randomUUID();
        // Two steps, as "Dodaj i citiraj": the source must be in the work before the place can point at it.
        if (apply(() => addSourceTransaction(editor.state, draft, id), t.linked)) {
          apply(() => linkPlaceTransaction(editor.state, open.pos, id), t.linked);
        }
      }} />}
    </Dialog>
    <Dialog open={open?.kind === "edit"} title={t.editTitle} onClose={close}>
      {open?.kind === "edit" && <SourceForm open floating={false} editing anchor={anchor} initial={open.draft}
        disabled={!editable} onClose={close} onSubmit={(draft) => {
          close();
          apply(() => editSourceTransaction(editor.state, open.id, draft), t.saved);
        }} />}
    </Dialog>
  </div>;
}
