"use client";

import { useState } from "react";

import EditorToolbarFor from "./EditorToolbarFor";
import { useLocalEditor } from "./LocalDocument";
import { EditorWorkParts } from "./parts/EditorWorkParts";

/** The writing page's toolbar, bound to its local document. */
export default function EditorToolbar({ workPartsKey }: { workPartsKey?: string } = {}) {
  const editor = useLocalEditor();
  const [partsOpen, setPartsOpen] = useState(false);
  return <>
    <EditorToolbarFor editor={editor} onOpenWorkParts={workPartsKey ? () => setPartsOpen(true) : undefined} />
    {partsOpen && editor && workPartsKey &&
      <EditorWorkParts editor={editor} storageKey={workPartsKey} onClose={() => setPartsOpen(false)} />}
  </>;
}
