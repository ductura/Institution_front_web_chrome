"use client";

import { useState } from "react";
import { Button, Dialog } from "@ductura/ui";
import type { Editor } from "@tiptap/react";

import { WorkPartsDialog } from "./WorkPartsDialog";
import { workPartsMessages as t } from "./messages.hr";
import { readWorkParts, readWorkPartsDisplay, writeWorkParts, writeWorkPartsDisplay } from "./work-parts-document";

export function EditorWorkParts({ editor, storageKey, onClose }: {
  editor: Editor; storageKey: string; onClose: () => void;
}) {
  const [initial] = useState(() => {
    const doc = editor.state.doc;
    const display = readWorkPartsDisplay(storageKey);
    return { doc, display, parts: readWorkParts(doc, display) };
  });
  if (!initial.parts) return (
    <Dialog open title={t.title} error={t.ambiguous} onClose={onClose}
      actions={<Button onClick={onClose}>{t.close}</Button>} />
  );
  return (
    <WorkPartsDialog value={initial.parts} declarationTemplate={t.declarationTemplate} onClose={onClose} onApply={(value) => {
      if (editor.isDestroyed || !editor.isEditable || editor.state.doc !== initial.doc) return false;
      const tr = editor.state.tr;
      if (!writeWorkParts(tr, value) || !writeWorkPartsDisplay(storageKey, initial.display, value)) return false;
      if (tr.docChanged) editor.view.dispatch(tr);
      return true;
    }} />
  );
}
