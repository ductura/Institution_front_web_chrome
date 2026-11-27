"use client";

import { Button, Dialog, type SourceDraft, type SourceFormAction } from "@ductura/ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { CitationPopover } from "@/components/editor/citations/CitationPopover";
import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { useLocalEditor, useLocalSignedOut } from "@/components/editor/LocalDocument";
import { QuickSource } from "@/components/editor/sources/quick-source/QuickSource";
import { createSourceLookup } from "@/components/editor/sources/quick-source/server-lookup";
import { documentSources } from "@/components/editor/sources/proofs/proof-sources";
import { TriggerPopover } from "@/components/editor/triggers/TriggerPopover";
import { useSlashCommands } from "../slash-commands";
import { loadNotebook } from "../source-notebook/notebook";
import { addSourceAt, jumpTo, mentionSources, nextPlace, unsourcedCitationPlaces, type MentionNote } from "./mention-model";
import { sourcesMentionHr as t } from "./messages.hr";
import { onSourceRequest } from "./source-requests";

/** Notes are read for the first sources only: a long bibliography must not start hundreds of requests (as the notebook). */
const MAX_NOTE_SOURCES = 30;

type LocalEditor = ReturnType<typeof useLocalEditor>;
type Read = { key: string; sources: unknown[]; places: number[]; editable: boolean };
const NONE: Read = { key: "none", sources: [], places: [], editable: false };

function readOf(editor: LocalEditor): Read {
  if (!editor || editor.isDestroyed) return NONE;
  const sources = Array.isArray(editor.state.doc.attrs.sources) ? (editor.state.doc.attrs.sources as unknown[]) : [];
  const places = unsourcedCitationPlaces(editor.state.doc).map((p) => p.pos);
  return { key: JSON.stringify([sources, places, editor.isEditable]), sources, places, editable: editor.isEditable };
}

/** The sources, the "[izvor]" places and whether the sheet is editable, read again after every transaction. */
function useRead(editor: LocalEditor): Read {
  const last = useRef(NONE);
  return useSyncExternalStore(
    (notify) => {
      editor?.on("transaction", notify);
      return () => { if (!editor?.isDestroyed) editor?.off("transaction", notify); };
    },
    () => {
      const next = readOf(editor);
      if (next.key !== last.current.key) last.current = next;
      return last.current;
    },
    () => NONE,
  );
}

/**
 * The "@" and "/" menus of the editor with the sources of the work (E§2.2, PARITET E 2): "@" lists up to 8 sources
 * and their notes, "Dodaj novi izvor…" opens the quick source dialog, the "Navod" button inserts a citation from the
 * list, and the line under the sheet counts citations left as "[izvor]" and jumps to the next one.
 * ED-34 (P2-9): `/podrijetlo` (group Rad) opens the work's provenance page through `openOrigin`.
 */
export function SourcesMention({ documentId, openOrigin }: { documentId: string; openOrigin?: () => void }) {
  // ED-14: "Brzi izvor" asks the server (`sources.lookup.post`); only the identifier is sent.
  const lookup = useMemo(() => createSourceLookup(), []);
  const editor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const [notes, setNotes] = useState<readonly MentionNote[]>([]);
  const [quick, setQuick] = useState<{ author: string } | null>(null);
  const [problem, setProblem] = useState<"addFailed" | "limit" | null>(null);
  // ED-100: the toolbar's "Navod" opens the picker below, "Novi izvor" the quick source dialog.
  const [citeAsked, setCiteAsked] = useState(0);
  useEffect(() => onSourceRequest((request) => {
    if (request === "newSource") setQuick({ author: "" });
    else setCiteAsked((n) => n + 1);
  }), []);

  const offered = useSlashCommands(editor);
  const read = useRead(editor);
  const sources = read.sources;
  const ids = useMemo(() => documentSources({ attrs: { sources } }), [sources]);
  const idsKey = JSON.stringify(ids);

  useEffect(() => {
    if (signedOut || ids.length === 0) { setNotes([]); return; }
    const controller = new AbortController();
    void loadNotebook(documentId, ids.slice(0, MAX_NOTE_SOURCES), controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // A failed or signed-out read leaves the menu without notes; the sources themselves are still there.
      setNotes(result.kind === "ready" ? result.entries.map((e) => ({
        sourceId: e.source.id, id: e.id, page: e.page, text: e.note ?? e.quote ?? "" })) : []);
    }, () => { if (!controller.signal.aborted) setNotes([]); });
    return () => controller.abort();
    // `ids` is read through its key: the same sources must not read the notes again.
  }, [documentId, idsKey, signedOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => mentionSources(sources, notes), [sources, notes]);
  if (signedOut || !editor) return null;

  const write = (draft: SourceDraft, action: SourceFormAction) => {
    setQuick(null);
    if (editor.isDestroyed || !editor.isEditable) return setProblem("addFailed");
    const outcome = addSourceAt(editor.view, draft, crypto.randomUUID(), action === "cite");
    setProblem(outcome === "ok" ? null : outcome === "limit" ? "limit" : "addFailed");
    editor.commands.focus();
  };
  const actions = {
    cite: (sourceId: string, page: string) => {
      const range = citationRange(editor.state);
      const tr = range && insertCitation(editor.state, range, sourceId, page);
      if (!tr) return setProblem("addFailed");
      editor.view.dispatch(tr);
      setProblem(null);
    },
    addSource: (author: string) => setQuick({ author }),
    // ED-46 (P2-18): "/fusnota" and "/ref" come from the toolbar's Umetni dialogs (slash-commands).
    commands: { ...offered, ...(openOrigin ? { podrijetlo: openOrigin } : {}) },
  };
  const places = read.places;
  const next = nextPlace(places, editor.state.selection.from);

  return <>
    <TriggerPopover editor={editor} sources={items} actions={actions} />
    <div role="group" aria-label={t.plainCount(places.length)}>
      <CitationPopover editor={editor} sources={ids.map((s) => ({ id: s.id, label: s.label }))} openRequest={citeAsked} />
      <span role="status">{t.plainCount(places.length)}</span>
      {next !== null && <Button tone="quiet" onClick={() => { editor.view.dispatch(jumpTo(editor.state, next)); editor.commands.focus(); }}>
        {t.plainNext}
      </Button>}
      {problem && <p role="alert">{t[problem]}</p>}
    </div>
    {/* Under <body>, not in the sheet: the white sheet sets its own ink but no raised surface (tokens.test.ts),
        so a dialog inside it would put the sheet's dark ink on the theme's dark dialog. */}
    {createPortal(<Dialog open={quick !== null} title={t.quickTitle} onClose={() => setQuick(null)}
      actions={<Button tone="quiet" onClick={() => setQuick(null)}>{t.cancel}</Button>}>
      {quick && <QuickSource allowCite disabled={!read.editable} lookup={lookup} onSubmit={write} />}
    </Dialog>, document.body)}
  </>;
}
