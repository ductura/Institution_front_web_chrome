"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";

import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { useLocalEditor, useLocalSignedOut } from "@/components/editor/LocalDocument";
import SourceList from "@/components/editor/sources/panel/SourceList";
import { listedSources } from "./mention-model";

type Doc = NonNullable<ReturnType<typeof useLocalEditor>>["state"]["doc"];

/** The list of the work's sources, re-read after every transaction. */
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

/** "Literatura" of the sources card: the sources of the work, cited or not yet, with "Citiraj" at the cursor (PARITET E 2). */
export function LiteratureList() {
  const editor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const doc = useDoc();
  const json = useMemo(() => (doc ? doc.toJSON() : null), [doc]);
  const items = useMemo(() => listedSources(json), [json]);
  if (signedOut || !editor || items.length === 0) return null;
  return <SourceList items={items.map(({ entry, cited }) => ({ entry, cited }))} editable={editor.isEditable}
    onCite={(item) => {
      const source = items.find((s) => s.entry === item.entry);
      if (!source || editor.isDestroyed || !editor.isEditable) return;
      const range = citationRange(editor.state);
      const tr = range && insertCitation(editor.state, range, source.id, "");
      if (tr) { editor.view.dispatch(tr); editor.commands.focus(); }
    }} />;
}
