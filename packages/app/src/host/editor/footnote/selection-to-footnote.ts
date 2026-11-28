/**
 * ED-95: the prototype's Pretvori › Označeno u fusnotu (features.js toFn). The selected text, within one
 * paragraph, leaves the line and becomes a footnote in the same place.
 */
import type { Editor } from "@tiptap/core";

import { insertAcademicAtom } from "@/components/editor/footnotes/inline-atoms";

import { prepareFootnoteText } from "./footnote-model";

export const selectionToFootnoteHr = {
  label: "Označeno u fusnotu",
  needsText: "Označite tekst unutar jednog odlomka.",
  failed: "Ovdje se fusnota ne može umetnuti.",
} as const;

export type SelectionToFootnote = "done" | "needsText" | "failed";

export function selectionToFootnote(editor: Editor, version: number | undefined): SelectionToFootnote {
  if (editor.isDestroyed || !editor.isEditable) return "failed";
  const { empty, from, to, $from, $to } = editor.state.selection;
  if (empty || !$from.sameParent($to)) return "needsText";
  const text = prepareFootnoteText(editor.state.doc.textBetween(from, to, " ", " "));
  if (!text) return text === "" ? "needsText" : "failed";
  const tr = insertAcademicAtom(editor.state, version, "footnote", { text });
  if (tr === null) return "failed";
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  return "done";
}
