"use client";

import { useState } from "react";

import EditorToolbarFor from "./EditorToolbarFor";
import { useLocalEditor } from "./LocalDocument";
import { EditorCitationSettings } from "./parts/EditorCitationSettings";
import { EditorWorkParts } from "./parts/EditorWorkParts";

/** The writing page's toolbar, bound to its local document. */
export default function EditorToolbar({ workPartsKey }: { workPartsKey?: string } = {}) {
  const editor = useLocalEditor();
  const [dialog, setDialog] = useState<"parts" | "citation" | null>(null);
  const close = () => setDialog(null);
  return <>
    <EditorToolbarFor editor={editor}
      onOpenWorkParts={workPartsKey ? () => setDialog("parts") : undefined}
      onOpenCitationSettings={workPartsKey ? () => setDialog("citation") : undefined} />
    {dialog === "parts" && editor && workPartsKey &&
      <EditorWorkParts editor={editor} storageKey={workPartsKey} onClose={close} />}
    {dialog === "citation" && <EditorCitationSettings onClose={close} />}
  </>;
}
