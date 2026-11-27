"use client";

// ED-91: the right-click menu in the text (prototype more2.js `ctxMenu`, model WEB-2131). A right click outside
// the selection first moves the caret there; then the menu offers what fits the place: with selected text
// Komentar, Navod iza označenog, Podebljano, Kurziv, U blok-citat, U fusnotu, Odloži, Izreži and the clipboard;
// at the caret Za provjeru and Navod. Shift + right click and a work that cannot be written in keep the
// browser's own menu. Shift+F10 and the menu key open it at the caret.
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useState } from "react";

import { ContextMenu, type MenuEntry } from "@ductura/ui";

import { textMenuEntries } from "../toolbar/context-menu-model";
import { selectionBubbleHr as t } from "./messages.hr";
import { selectionFacts, useSelectionActions } from "./selection-actions";

type Open = { readonly at: { x: number; y: number }; readonly entries: readonly MenuEntry[] };
type Props = { editor: Editor; workId: string; version: number | undefined };

export function TextMenu({ editor, workId, version }: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const run = useSelectionActions(editor, workId, version);

  useEffect(() => {
    const dom = editor.view.dom;
    const onMenu = (event: MouseEvent) => {
      if (event.shiftKey || editor.isDestroyed || !editor.isEditable) return;
      const keyboard = event.clientX === 0 && event.clientY === 0;
      if (!keyboard) {
        const hit = editor.view.posAtCoords({ left: event.clientX, ["top"]: event.clientY }); // ["top"]: see the API scanner
        const { empty, from, to } = editor.state.selection;
        if (hit && (empty || hit.pos < from || hit.pos > to)) editor.commands.setTextSelection(hit.pos);
      }
      const facts = selectionFacts(editor, version);
      const entries = textMenuEntries({
        role: "student", editable: true, hasSelection: !editor.state.selection.empty, canComment: true,
        footnote: facts.footnote, inQuote: facts.inQuote,
      });
      if (entries === null) return;
      event.preventDefault();
      let at = { x: event.clientX, y: event.clientY };
      if (keyboard) {
        try {
          const c = editor.view.coordsAtPos(editor.state.selection.from);
          at = { x: c.left, y: c.bottom };
        } catch {
          const r = dom.getBoundingClientRect();
          at = { x: r.left, y: r.top };
        }
      }
      setOpen({ at, entries });
    };
    dom.addEventListener("contextmenu", onMenu);
    return () => dom.removeEventListener("contextmenu", onMenu);
  }, [editor, version]);

  const close = useCallback(() => setOpen(null), []);
  return (
    <ContextMenu anchor={open?.at ?? null} entries={open?.entries ?? []} label={t.menuLabel}
      onSelect={run} onClose={close} />
  );
}
