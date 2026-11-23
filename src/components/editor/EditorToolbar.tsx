"use client";

import { useState } from "react";

import EditorToolbarFor from "./EditorToolbarFor";
import { useLocalEditor } from "./LocalDocument";
import { useV3EditorDialogs, type FootnoteDialogComponent } from "./footnotes/useV3EditorDialogs";
import { EditorCitationSettings } from "./parts/EditorCitationSettings";
import { EditorWorkParts } from "./parts/EditorWorkParts";

/** The writing page's toolbar, bound to its local document. */
export default function EditorToolbar({ workPartsKey, confirmedWorkSchemaVersion, footnoteDialog }: {
  workPartsKey?: string;
  /** The server-confirmed version of this work's revision zero, supplied at opening (WEB-7F). */
  confirmedWorkSchemaVersion?: number;
  /** The host's footnote dialog; absent, the copied one opens (PIL-K-FUSNOTA). */
  footnoteDialog?: FootnoteDialogComponent;
} = {}) {
  const editor = useLocalEditor();
  const v3 = useV3EditorDialogs(editor, confirmedWorkSchemaVersion, footnoteDialog);
  const [dialog, setDialog] = useState<"parts" | "citation" | null>(null);
  const close = () => setDialog(null);
  return <>
    <EditorToolbarFor editor={editor}
      onOpenWorkParts={workPartsKey ? () => setDialog("parts") : undefined}
      onOpenCitationSettings={workPartsKey ? () => setDialog("citation") : undefined}
      onOpenAcademicAtom={v3.openInsert} />
    {dialog === "parts" && editor && workPartsKey &&
      <EditorWorkParts editor={editor} storageKey={workPartsKey} onClose={close} />}
    {dialog === "citation" && <EditorCitationSettings onClose={close} />}
    {v3.dialog}
  </>;
}
