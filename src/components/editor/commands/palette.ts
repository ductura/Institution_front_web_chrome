import type { Editor } from "@tiptap/react";
import type { Command } from "@ductura/ui";
import { numberedHeadings } from "@/editor";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { citationRange, insertCitation } from "../citations/citation-document";
import { requestFocusMode } from "../layout-prefs/focus-mode";
import { documentSources } from "../sources/proofs/proof-sources";
import { requestWorkHistory, workHistoryOffered } from "./work-history-event";
import { BLOCK_STYLES, stateOf, TOOLS } from "../EditorToolbarFor";
import { convertBlock, copyText, insertHole } from "../toolbar-menu";
import { editorCommandsHr as text } from "./messages.hr";
import { requestPanel } from "../layout-prefs/open-panel";
import { askPrintPreview } from "../print-export/print-event";
import { askComment } from "../../../../packages/app/src/host/editor/comments/ask-comment";
import { slashCommandsOf } from "../../../../packages/app/src/host/editor/slash-commands";
import { insertSourceAction } from "../../../../packages/app/src/host/editor/sources-mention/new-source-request";

type Action = Command & { run?: () => void };

/**
 * What a submitted (read-only) work still offers: reading, finding, viewing and exporting, as the prototype's
 * palette in its read mode (toolbar2.js, flag "smije i kad je rad predan"). Focus mode stays (WEB-1605).
 */
const READABLE = new Set(["shortcuts", "find", "history", "focus", "copy", "outline", "docx", "print"]);

export function paletteActions(editor: Editor, showShortcuts: () => void, openFind?: () => void): Action[] {
  const state = stateOf(editor);
  const action = (id: string, label: string, run?: () => void, hint?: string, disabled = !run): Action => ({
    id, label, run, hint, disabled, group: text.palette,
  });
  const edit = (fn: () => void) => () => {
    if (!editor.isDestroyed && editor.isEditable) fn();
  };
  // ED-92: what Umetni offers runs from here too, through the same doors; the palette closes first (later()).
  const offered = slashCommandsOf(editor);
  const later = (fn?: () => void) => fn && (() => { setTimeout(fn, 0); });
  const selected = !editor.state.selection.empty;
  const commands = [
    action("shortcuts", text.shortcuts, showShortcuts, "Ctrl+/"),
    action("find", text.findAndReplace, openFind, "Ctrl+F"),
    // ED-16 (NF2-P14): the one history dialog, offered only where a host knows the document.
    ...(workHistoryOffered() ? [action("history", text.history, () => { requestWorkHistory(); })] : []),
    ...TOOLS.filter(({ key }) => key !== "blockStyle").map((tool) => action(
      tool.key, tool.label, edit(() => tool.run(editor)), tool.keys,
      !state.editable || !(tool.enabled?.(state) ?? true),
    )),
    ...BLOCK_STYLES.map((style) => action(style.key, style.label, edit(() => style.run(editor)), undefined, !state.editable)),
    action("toQuote", t.toolbar.convertItems.toQuote, edit(() => convertBlock(editor, "quote")), text.selectedText,
      !state.editable || editor.state.selection.empty),
    action("hole", t.toolbar.insertItems.hole, edit(() => insertHole(editor)), undefined, !state.editable),
    action("copy", text.copyWork, () => { void copyText(editor); }),
    action("cite", t.toolbar.insertItems.cite, edit(() => insertSourceAction(editor, "cite")), "@", !state.editable),
    action("newSource", t.toolbar.insertItems.newSource, edit(() => insertSourceAction(editor, "newSource")), undefined, !state.editable),
    ...(["table", "image"] as const).map((key) => action(key, t.toolbar.insertItems[key])),
    action("footnote", t.toolbar.insertItems.footnote, later(offered.fusnota), "/fusnota", !state.editable || !offered.fusnota),
    action("xref", t.toolbar.insertItems.xref, later(offered.ref), "/ref", !state.editable || !offered.ref),
    // ED-111: Fraza opens "Fraze" through "/fraza", whenever the toolbar offers it.
    action("phrase", t.toolbar.insertItems.phrase, later(offered.fraza), "/fraza", !state.editable || !offered.fraza),
    // A comment stands on the selected text, as the selection bubble's Komentar.
    action("comment", text.comment, edit(() => { requestPanel("comments"); askComment(""); }), text.selectedText,
      !state.editable || !selected),
    action("focus", text.focus, () => requestFocusMode(), "Ctrl+."),
    action("outline", text.outline, undefined, "Ctrl+\\"),
    action("docx", t.toolbar.exportItems.docx),
    action("print", t.toolbar.exportItems.print, () => { askPrintPreview(); }),
  ];
  return [
    // ED-46 (P2-18): a submitted work lists only what it still allows, not a page of disabled writing tools.
    ...(state.editable ? commands : commands.filter(({ id }) => READABLE.has(id))),
    // Chapters and sources come with a typed query only (prototype: "Poglavlja" and "Izvori" under the commands).
    ...numberedHeadings(editor.state.doc).filter(({ title }) => title).map(({ pos, title, number }): Action => ({
      id: `heading:${pos}`, group: text.chapters, label: `${number} ${title}`.trim(), hint: text.goTo, searchOnly: true,
      run: () => {
        if (!editor.isDestroyed) editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
      },
    })),
    ...(state.editable ? sourceActions(editor) : []),
  ];
}

/** "Izvori": each source of the work, found by author, year or title; Enter cites it where the cursor is. */
function sourceActions(editor: Editor): Action[] {
  const raw: unknown = editor.state.doc.attrs.sources;
  const titles = new Map((Array.isArray(raw) ? raw : []).flatMap((s: unknown) => {
    const source = s as { id?: unknown; title?: unknown } | null;
    return typeof source?.id === "string" && typeof source.title === "string" ? [[source.id, source.title] as const] : [];
  }));
  const cite = (sourceId: string) => {
    if (editor.isDestroyed || !editor.isEditable) return;
    const range = citationRange(editor.state);
    const tr = range && insertCitation(editor.state, range, sourceId, "");
    if (tr) editor.view.dispatch(tr);
    editor.commands.focus();
  };
  const canCite = citationRange(editor.state) !== null;
  return documentSources({ attrs: { sources: raw } } as never).map(({ id, label }): Action => {
    const title = titles.get(id);
    return {
      id: `source:${id}`, group: text.sources, searchOnly: true, disabled: !canCite,
      label: title && !label.includes(title) ? `${label}, ${title}` : label, hint: text.cite,
      run: () => cite(id),
    };
  });
}
