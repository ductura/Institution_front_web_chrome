"use client";

import { useEffect, useState } from "react";
import type { Node } from "@tiptap/pm/model";

import { ReviewPlaces } from "../../../../../../src/components/editor/citations/ReviewPlaces.tsx";
import { reviewPlaces } from "../../../../../../src/components/editor/citations/review-places.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { useSelectedWords } from "../../../../../../src/components/editor/StatusLength.tsx";
import { rehearsalSupplements, selectedLabel, type Supplements } from "./status-model.ts";
import { statusHostHr as t } from "./messages.hr.ts";

/** The open editor's document, read again after every transaction; null without an editor. */
function useDocument(): Node | null {
  const editor = useLocalEditor();
  const [doc, setDoc] = useState<Node | null>(null);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return setDoc(null);
    const read = () => setDoc(editor.isDestroyed ? null : editor.state.doc);
    read();
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  return doc;
}

/** "označeno: n riječi" and "n za provjeru" / "ništa za provjeru" at the end of the status bar (prototype app.js). */
export function StatusExtras() {
  const editor = useLocalEditor();
  const doc = useDocument();
  const selected = selectedLabel(useSelectedWords());
  if (doc === null) return null;
  return <>
    {selected && <span>{selected}</span>}
    {reviewPlaces(doc).length === 0 ? <span>{t.noHoles}</span> : <ReviewPlaces editor={editor} />}
  </>;
}

/** The rehearsal's extra rows, read from the open document. */
export function useRehearsalSupplements(): Supplements {
  return rehearsalSupplements(useDocument());
}
