import type { Editor } from "@tiptap/react";
import type { Command } from "@ductura/ui";
import { numberedHeadings } from "@/editor";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { requestFocusMode } from "../layout-prefs/focus-mode";
import { requestWorkHistory } from "./work-history-event";
import { BLOCK_STYLES, stateOf, TOOLS } from "../EditorToolbarFor";
import { convertBlock, copyText, insertHole } from "../toolbar-menu";
import { editorCommandsHr as text } from "./messages.hr";

type Action = Command & { run?: () => void };

export function paletteActions(editor: Editor, showShortcuts: () => void, openFind?: () => void): Action[] {
  const state = stateOf(editor);
  const action = (id: string, label: string, run?: () => void, hint?: string, disabled = !run): Action => ({
    id, label, run, hint, disabled, group: text.palette,
  });
  const edit = (fn: () => void) => () => {
    if (!editor.isDestroyed && editor.isEditable) fn();
  };
  return [
    action("shortcuts", text.shortcuts, showShortcuts, "Ctrl+/"),
    action("find", text.findAndReplace, openFind, "Ctrl+F"),
    // ED-16 (NF2-P14): the one history dialog; the host that knows the document answers.
    action("history", text.history, () => { requestWorkHistory(); }),
    ...TOOLS.filter(({ key }) => key !== "blockStyle").map((tool) => action(
      tool.key, tool.label, edit(() => tool.run(editor)), tool.keys,
      !state.editable || !(tool.enabled?.(state) ?? true),
    )),
    ...BLOCK_STYLES.map((style) => action(style.key, style.label, edit(() => style.run(editor)), undefined, !state.editable)),
    action("toQuote", t.toolbar.convertItems.toQuote, edit(() => convertBlock(editor, "quote")), text.selectedText,
      !state.editable || editor.state.selection.empty),
    action("hole", t.toolbar.insertItems.hole, edit(() => insertHole(editor)), undefined, !state.editable),
    action("copy", text.copyWork, () => { void copyText(editor); }),
    ...(["cite", "newSource", "table", "image", "footnote", "xref", "phrase"] as const)
      .map((key) => action(key, t.toolbar.insertItems[key])),
    action("comment", text.comment),
    action("focus", text.focus, () => requestFocusMode(), "Ctrl+."),
    action("outline", text.outline, undefined, "Ctrl+\\"),
    action("docx", t.toolbar.exportItems.docx),
    action("print", t.toolbar.exportItems.print),
    ...numberedHeadings(editor.state.doc).filter(({ title }) => title).map(({ pos, title, number }): Action => ({
      id: `heading:${pos}`, group: text.chapters, label: `${number} ${title}`.trim(), hint: text.goTo,
      run: () => {
        if (!editor.isDestroyed) editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
      },
    })),
  ];
}
