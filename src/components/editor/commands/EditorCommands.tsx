"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState } from "@tiptap/react";
import { Button, CommandPalette, ShortcutsDialog } from "@ductura/ui";

import { useLocalEditor, useLocalSignedOut } from "../LocalDocument";
import { editorCommandsHr as t } from "./messages.hr";
import { EditorFind } from "./EditorFind";
import { paletteActions } from "./palette";
import { editorShortcut, shortcutGroups } from "./shortcuts";
import styles from "./EditorCommands.module.css";

type DialogName = "palette" | "shortcuts";

export default function EditorCommands({ children }: { children: ReactNode }) {
  const localEditor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const editor = signedOut ? null : localEditor;
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const toolbar = useRef<HTMLDivElement>(null);
  const snapshot = useEditorState({ editor, selector: ({ editor: current }) => current && {
    doc: current.state.doc, selection: current.state.selection, editable: current.isEditable,
  }, equalityFn: (a, b) => a?.doc === b?.doc && a?.selection === b?.selection && a?.editable === b?.editable });

  const openFind = () => { setFindOpen(true); setOpenCount((count) => count + 1); };
  const closeFind = () => { setFindOpen(false); editor?.view.focus(); };

  useEffect(() => {
    if (!editor) return;
    const keyDown = (event: KeyboardEvent) => {
      const action = editorShortcut(event);
      const target = event.target as HTMLElement | null;
      if (!event.defaultPrevented && event.key === "Escape" && findOpen && dialog === null && !target?.closest?.("dialog")) {
        event.preventDefault();
        setFindOpen(false);
        editor.view.focus();
        return;
      }
      if (!action || (target?.closest?.("dialog") && dialog === null)) return;
      if (action === "find") {
        if (dialog !== null) return;
        event.preventDefault();
        openFind();
        return;
      }
      if (action === "toolbar") {
        if (dialog !== null) return;
        event.preventDefault();
        toolbar.current?.querySelector<HTMLElement>("[data-roving][tabindex='0']:enabled, [data-command-trigger]:enabled")?.focus();
        return;
      }
      event.preventDefault();
      setDialog(dialog === action ? null : action);
    };
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [editor, dialog, findOpen]);

  const actions = editor && dialog === "palette" ? paletteActions(editor, () => setDialog("shortcuts"), openFind) : [];
  const close = () => setDialog(null);

  return (
    <>
      <div className={styles.row} ref={toolbar} onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) editor?.view.focus();
      }}>
        <div className={styles.tools}>{children}</div>
        {editor ? <Button tone="quiet" aria-expanded={findOpen} aria-keyshortcuts="Control+F Meta+F"
          title={`${t.find} (Ctrl+F)`} onClick={openFind}>{t.find}</Button> : null}
        {editor ? <Button tone="quiet" data-command-trigger="" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K"
          title={`${t.palette} (Ctrl+K)`} onClick={() => setDialog("palette")}>
          {t.palette}
        </Button> : null}
      </div>
      {editor && findOpen ? <EditorFind editor={editor} onClose={closeFind} openCount={openCount} /> : null}
      <CommandPalette open={!!editor && dialog === "palette"} commands={actions} onClose={close}
        onRun={(id) => actions.find((action) => action.id === id && !action.disabled)?.run?.()} />
      <ShortcutsDialog open={!!editor && dialog === "shortcuts"} groups={shortcutGroups(snapshot?.editable ?? false)} onClose={close} />
    </>
  );
}
