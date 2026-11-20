"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ContextMenu, ToastRegion, useToasts, type MenuPoint } from "@ductura/ui";

import { contextActions } from "./context-actions";
import { editorCommandsHr as t } from "./messages.hr";
import styles from "./EditorCommands.module.css";

export function EditorContext({ editor, openMenu }: { editor: Editor; openMenu: (menu: "insert" | "chars") => void }) {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const { toasts, show, dismiss } = useToasts();
  const snapshot = useEditorState({ editor, selector: ({ editor }) => ({
    editable: editor.isEditable, from: editor.state.selection.from, to: editor.state.selection.to,
  }) });

  useEffect(() => {
    const view = editor.view;
    const openAtCaret = (event: Event) => {
      const coords = view.coordsAtPos(view.state.selection.from);
      event.preventDefault();
      event.stopPropagation();
      setAnchor({ x: coords.left, y: coords.bottom });
    };
    const contextMenu = (event: PointerEvent) => {
      if (event.defaultPrevented || event.shiftKey || (event.pointerType && event.pointerType !== "mouse") || !editor.isEditable) return;
      if (!event.clientX && !event.clientY) return openAtCaret(event);
      const position = { left: event.clientX, ["top"]: event.clientY };
      const hit = view.posAtCoords(position);
      const { doc, selection } = view.state;
      if (hit && (selection.empty || hit.pos < selection.from || hit.pos > selection.to) && doc.resolve(hit.pos).parent.isTextblock) {
        editor.commands.setTextSelection(hit.pos);
      }
      event.preventDefault();
      event.stopPropagation();
      setAnchor({ x: event.clientX, y: event.clientY });
    };
    const menuKey = (event: KeyboardEvent) => {
      if (!editor.isEditable || event.defaultPrevented || event.isComposing) return;
      if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey)) {
        openAtCaret(event);
      }
    };
    view.dom.addEventListener("contextmenu", contextMenu, true);
    view.dom.addEventListener("keydown", menuKey, true);
    return () => {
      view.dom.removeEventListener("contextmenu", contextMenu, true);
      view.dom.removeEventListener("keydown", menuKey, true);
    };
  }, [editor]);

  useEffect(() => {
    if (!snapshot.editable) close();
  }, [snapshot.editable, close]);

  const entries = snapshot.editable && anchor ? contextActions(editor, show, openMenu) : [];
  return (
    <div className={styles.context}>
      <ContextMenu anchor={snapshot.editable ? anchor : null} entries={entries} label={t.contextMenu} onClose={close}
        onSelect={(id) => {
          if (editor.isDestroyed || !editor.isEditable) return;
          entries.find((entry) => entry.kind === "item" && entry.id === id && !entry.disabled)?.run?.();
        }} />
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.clipboardNotice} closeLabel={t.close} />
    </div>
  );
}
