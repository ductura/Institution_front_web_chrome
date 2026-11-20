import type { Editor } from "@tiptap/react";
import type { MenuEntry } from "@ductura/ui";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { convertBlock, insertHole } from "../toolbar-menu";
import { editorCommandsHr as t } from "./messages.hr";

const toolbar = messagesHr.toolbar;
type Action = MenuEntry & { run?: () => void };

export function contextActions(editor: Editor, report: (text: string) => void, openMenu: (menu: "insert" | "chars") => void): Action[] {
  const heading = (label: string): Action => ({ kind: "heading", label });
  const item = (id: string, label: string, hint?: string, run?: () => void): Action => ({
    kind: "item", id, label, hint, run, disabled: !run,
  });
  const clipboard = (command: "copy" | "cut" | "paste", hint: string) => () => {
    const view = editor.view;
    view.focus();
    try {
      if (view.dom.ownerDocument.execCommand(command)) return;
    } catch {
      // Browsers can restrict clipboard commands to native keyboard events.
    }
    report(hint);
  };
  const footer = heading(t.contextBrowser);
  if (!editor.state.selection.empty) return [
    heading(t.selection),
    item("comment", t.comment, "Ctrl+Alt+M"), item("citeAfter", t.citeAfter), item("marker", t.marker, "›"),
    heading(t.format),
    item("bold", toolbar.bold, "Ctrl+B", () => { editor.chain().focus().toggleBold().run(); }),
    item("italic", toolbar.italic, "Ctrl+I", () => { editor.chain().focus().toggleItalic().run(); }),
    item("exponent", t.exponent, "x²"), item("subscript", t.subscript, "H₂O"),
    heading(t.move),
    item("toQuote", t.toQuote, undefined, () => { convertBlock(editor, "quote"); }),
    item("toFootnote", t.toFootnote), item("stash", t.stash),
    item("cut", t.cut, "Ctrl+X", clipboard("cut", t.cutHint)),
    item("copy", t.copy, "Ctrl+C", clipboard("copy", t.copyHint)),
    footer,
  ];
  return [
    heading(t.here),
    item("cite", toolbar.insertItems.cite, "@"),
    item("hole", toolbar.insertItems.hole, undefined, () => { insertHole(editor); }),
    item("insert", toolbar.insert, "›", () => openMenu("insert")),
    item("chars", toolbar.specialChar, "›", () => openMenu("chars")),
    item("paste", t.paste, "Ctrl+V", clipboard("paste", t.pasteHint)),
    heading(t.paragraph),
    item("bullets", t.bullets, undefined, () => { editor.chain().focus().toggleNode("bulletItem", "paragraph").run(); }),
    item("numbering", t.numbering),
    item("quote", toolbar.quote, undefined, () => { editor.chain().focus().toggleNode("quote", "paragraph").run(); }),
    item("markBlock", t.markBlock), item("breakAfter", t.breakAfter),
    item("selectAll", t.selectAll, "Ctrl+A", () => { editor.chain().focus().selectAll().run(); }),
    footer,
  ];
}
