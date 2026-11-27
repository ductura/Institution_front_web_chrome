"use client";

// ED-75 and ED-91: what the bubble and the right-click menu do to the selected text (or at the caret). Each
// action runs the path the rest of the editor already has; one place, so the two never drift apart.
import type { Editor } from "@tiptap/core";
import { useCallback } from "react";

import { insertAcademicAtom } from "@/components/editor/footnotes/inline-atoms";
import { requestPanel } from "@/components/editor/layout-prefs/open-panel";
import { convertBlock, insertHole } from "@/components/editor/toolbar-menu";
import { requestCiteAtCaret } from "@/components/editor/triggers/TriggerPopover";

import { useStudentToast } from "../../student/toast/StudentToasts";
import { askComment } from "../comments/ask-comment";
import { prepareFootnoteText } from "../footnote/footnote-model";
import { parseStash, stashAdd } from "../left/left-model";
import { useDeviceValue } from "../left/use-left";
import { selectionBubbleHr as t } from "./messages.hr";

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export type SelectionFacts = { readonly text: string; readonly inQuote: boolean; readonly footnote: boolean };

/** What the selection is: its text, whether it already stands in a quote, whether a footnote can take it. */
export function selectionFacts(editor: Editor, version: number | undefined): SelectionFacts {
  const { from, to, empty } = editor.state.selection;
  return {
    text: empty ? "" : editor.state.doc.textBetween(from, to, " ", " "),
    inQuote: editor.isActive("quote"),
    footnote: !empty && insertAcademicAtom(editor.state, version, "footnote", { text: "x" }) !== null,
  };
}

/** Runs one action by its id (the bubble's and the right-click menu's ids); unknown ids do nothing. */
export function useSelectionActions(editor: Editor, workId: string, version: number | undefined): (id: string) => void {
  const [stash, setStash] = useDeviceValue("stash", workId, parseStash, []);
  const toast = useStudentToast();

  return useCallback((id: string) => {
    if (editor.isDestroyed || !editor.isEditable) return;
    const { to } = editor.state.selection;
    const { text } = selectionFacts(editor, version);
    const toClipboard = async (cut: boolean) => {
      try {
        await navigator.clipboard.writeText(text);
        if (cut) editor.chain().deleteSelection().focus().run();
      } catch {
        toast(t.failed, "error");
      }
    };
    switch (id) {
      case "comment":
        requestPanel("comments");
        askComment("");
        return;
      case "cite":
      case "citeAfter":
        editor.chain().setTextSelection(to).focus().run();
        if (!requestCiteAtCaret(editor)) requestPanel("sources");
        return;
      case "toQuote":
        if (!convertBlock(editor, "quote")) toast(t.failed, "error");
        return;
      case "toFootnote": {
        const note = prepareFootnoteText(text);
        const tr = note ? insertAcademicAtom(editor.state, version, "footnote", { text: note }) : null;
        if (tr === null) return toast(t.failed, "error");
        editor.view.dispatch(tr.scrollIntoView());
        editor.commands.focus();
        return toast(t.footnoteDone);
      }
      case "stash":
        if (text.trim() === "") return;
        if (!setStash(stashAdd(stash, text, newId(), new Date().toISOString()))) return toast(t.stashFailed, "error");
        editor.chain().deleteSelection().focus().run();
        return toast(t.stashed);
      case "hole":
        if (!insertHole(editor)) toast(t.failed, "error");
        return;
      case "bold":
        editor.chain().focus().toggleBold().run();
        return;
      case "italic":
        editor.chain().focus().toggleItalic().run();
        return;
      case "cut":
      case "copy":
        void toClipboard(id === "cut");
        return;
    }
  }, [editor, version, stash, setStash, toast]);
}
