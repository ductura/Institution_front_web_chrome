"use client";

// PIL-K-TRAKA (WEB-1601/2131): the student's editor draws EditorToolbarHost in the tools slot, in place of
// the copied EditorToolbar. Every tool runs the very command the copied toolbar ran (TOOLS, BLOCK_STYLES of
// EditorToolbarFor, same checks at the click), so a change reaches the journal as before. What the new bar has
// no button for (Umetni, Pretvori, Posebni znak, Prikaz, Izvezi and their dialogs) stays here as menus over
// the same helpers and the same words; nothing is new in look or in text.
import { useEffect, useState } from "react";
import { Button, ContextMenu, type MenuEntry, type MenuPoint } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import { BLOCK_STYLES, blockStyleOf, stateOf, TOOLS, type ToolbarState as EditorState } from "@/components/editor/EditorToolbarFor";
import { useLocalEditor } from "@/components/editor/LocalDocument";
import { crossReferenceMessages } from "@/components/editor/crossref/messages.hr";
import { useV3EditorDialogs, type FootnoteDialogComponent } from "@/components/editor/footnotes/useV3EditorDialogs";
import { EditorCitationSettings } from "@/components/editor/parts/EditorCitationSettings";
import { EditorWorkParts } from "@/components/editor/parts/EditorWorkParts";
import { workPartsMessages } from "@/components/editor/parts/messages.hr";
import { setSheetTheme, useSheetTheme } from "@/components/shell/useSheetTheme";
import {
  convertBlock, glyphOf, insertChar, insertHole, pushRecent, readRecent, SPECIAL_CHARS, writeRecent,
} from "@/components/editor/toolbar-menu";
import { textWithFootnotes } from "@/lib/document/text-with-footnotes";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { ReadAloudControls } from "../read-aloud/ReadAloudControls";
import { EditorToolbarHost } from "./EditorToolbarHost";
import type { BlockStyle, ToolbarCommands, ToolbarState } from "./toolbar-model";

/** "Stavi tekst rada u međuspremnik": text with [n] marks and the footnote list (v3). False when refused. */
async function copyWorkText(editor: Editor | null): Promise<boolean> {
  if (!editor || editor.isDestroyed) return false;
  try {
    await globalThis.navigator.clipboard.writeText(textWithFootnotes(editor));
    return true;
  } catch {
    return false;
  }
}

const live = (editor: Editor | null): editor is Editor => !!editor && !editor.isDestroyed && editor.isEditable;

/** The editor's state as the toolbar model wants it. The V2 schema has no numbered list, so it is never on. */
export function toolbarStateOf(s: EditorState): ToolbarState {
  return {
    canUndo: s.canUndo, canRedo: s.canRedo, block: blockStyleOf(s), bold: s.bold, italic: s.italic,
    bulletList: s.bulletItem, numberedList: false, quote: s.quote, editable: s.editable,
  };
}

/** The names the copied toolbar gave its tools, kept (the @ductura/ui bar names the headings and the quote differently). */
/** The copied toolbar's accessible name, kept for the bar (WEB-15 finds the bar by it). */
export const KEPT_TOOLBAR_LABEL = t.toolbar.label;

export const KEPT_LABELS = {
  heading1: t.toolbar.heading1, heading2: t.toolbar.heading2, heading3: t.toolbar.heading3, quote: t.toolbar.quote,
} as const;

/** The toolbar's commands over one editor: the copied toolbar's own, checked again at the click. */
export function toolbarCommands(editor: Editor | null): ToolbarCommands {
  const tool = (key: string) => () => {
    const found = TOOLS.find((candidate) => candidate.key === key);
    if (!found || !live(editor) || !(found.enabled?.(stateOf(editor)) ?? true)) return;
    found.run(editor);
  };
  return {
    undo: tool("undo"), redo: tool("redo"), toggleBold: tool("bold"), toggleItalic: tool("italic"),
    toggleBulletList: tool("bulletItem"), toggleQuote: tool("quote"), toggleNumberedList: () => undefined,
    setBlock: (style: BlockStyle) => { if (live(editor)) BLOCK_STYLES.find((b) => b.key === style)?.run(editor); },
  };
}

type Item = { id: string; label: string; disabled?: boolean };

function Menu({ label, items, onSelect }: { label: string; items: readonly Item[]; onSelect: (id: string) => void }) {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const entries: MenuEntry[] = items.map((i) => ({ kind: "item", id: i.id, label: i.label, disabled: i.disabled }));
  return (
    <>
      <Button tone="quiet" aria-haspopup="menu"
        onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setAnchor({ x: b.left, y: b.bottom }); }}>{label} ▾</Button>
      <ContextMenu anchor={anchor} entries={entries} label={label} onClose={() => setAnchor(null)}
        onSelect={(id) => { setAnchor(null); onSelect(id); }} />
    </>
  );
}

/** The editor's state, read again on every transaction and kept when nothing changed (the host has no @tiptap/react). */
function useEditorSnapshot(editor: Editor | null): EditorState {
  const [state, setState] = useState<EditorState>(() => stateOf(editor));
  useEffect(() => {
    const read = () => setState((was) => { const next = stateOf(editor); return JSON.stringify(was) === JSON.stringify(next) ? was : next; });
    read();
    if (!editor || editor.isDestroyed) return;
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  return state;
}

/** The student's toolbar, bound to the local document. */
export function StudentToolbar({ workPartsKey, footnoteDialog, confirmedWorkSchemaVersion }: {
  workPartsKey: string; footnoteDialog?: FootnoteDialogComponent; confirmedWorkSchemaVersion?: number;
}) {
  const editor = useLocalEditor();
  const state = useEditorSnapshot(editor);
  const theme = useSheetTheme();
  const v3 = useV3EditorDialogs(editor, confirmedWorkSchemaVersion, footnoteDialog);
  const [dialog, setDialog] = useState<"parts" | "citation" | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const writeOk = live(editor) && state.editable;

  const insert: Item[] = [
    { id: "footnote", label: t.toolbar.insertItems.footnote, disabled: !writeOk || !v3.openInsert },
    { id: "xref", label: crossReferenceMessages.title, disabled: !writeOk || !v3.openInsert },
    { id: "hole", label: t.toolbar.insertItems.hole, disabled: !writeOk },
    { id: "workParts", label: workPartsMessages.title, disabled: !writeOk },
  ];
  const convert: Item[] = [
    { id: "toQuote", label: t.toolbar.convertItems.toQuote, disabled: !writeOk || state.quote },
    { id: "fromQuote", label: t.toolbar.convertItems.fromQuote, disabled: !writeOk || !state.quote },
  ];
  const chars = [...recent, ...SPECIAL_CHARS.filter((ch) => !recent.includes(ch))]
    .map((ch): Item => ({ id: `char:${ch}`, label: `${glyphOf(ch)}  ${t.toolbar.specialChars[ch] ?? ""}`, disabled: !writeOk }));
  const view: Item[] = [
    { id: "dark", label: `${theme === "dark" ? "✓ " : ""}${t.workspace.sheetThemeDark}` },
    { id: "light", label: `${theme === "light" ? "✓ " : ""}${t.workspace.sheetThemeLight}` },
    { id: "citationSettings", label: workPartsMessages.citationTitle },
  ];
  return (
    <>
      <EditorToolbarHost state={toolbarStateOf(state)} commands={toolbarCommands(editor)} label={KEPT_TOOLBAR_LABEL} labels={KEPT_LABELS} omit={["numberedList"]} />
      <Menu label={t.toolbar.insert} items={insert} onSelect={(id) => {
        if (id === "footnote") v3.openInsert?.("footnote");
        else if (id === "xref") v3.openInsert?.("crossReference");
        else if (id === "workParts" && writeOk) setDialog("parts");
        else if (id === "hole") insertHole(editor);
      }} />
      <Menu label={t.toolbar.convert} items={convert} onSelect={(id) => {
        if (id === "toQuote" || id === "fromQuote") convertBlock(editor, id === "toQuote" ? "quote" : "paragraph");
      }} />
      <Menu label={t.toolbar.specialChar} items={chars} onSelect={(id) => {
        const ch = id.slice("char:".length);
        if (!insertChar(editor, ch)) return;
        const next = pushRecent(recent, ch);
        setRecent(next);
        writeRecent(next);
      }} />
      <Menu label={t.toolbar.view} items={view} onSelect={(id) => {
        if (id === "citationSettings") setDialog("citation");
        else setSheetTheme(id === "light" ? "light" : "dark");
      }} />
      <Menu label={t.toolbar.export} items={[{ id: "copy", label: t.toolbar.exportItems.copy, disabled: !editor || editor.isDestroyed }]}
        onSelect={(id) => { if (id === "copy") void copyWorkText(editor); }} />
      <ReadAloudControls editor={editor} />
      {dialog === "parts" && editor && <EditorWorkParts editor={editor} storageKey={workPartsKey} onClose={() => setDialog(null)} />}
      {dialog === "citation" && <EditorCitationSettings onClose={() => setDialog(null)} />}
      {v3.dialog}
    </>
  );
}
