/**
 * What the dialogs and menus of the rich blocks do to the editor (E§3.4).
 * Every function runs the editor's own v4 commands (extensions-v4.ts), which
 * tidy and validate; nothing here writes the document another way, so a
 * change reaches the journal exactly as typing does. A function returns false
 * when the editor refused, and the caller says so.
 */

import { BOX_KINDS, CODE_LANGUAGES, type BoxKind, type CodeLanguage } from "@/domain/document";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

/** A chain that also focuses the editor when it is on the page (a dialog or menu had the focus). */
function chain(editor: Editor) {
  const c = editor.chain();
  try {
    return editor.view.dom.isConnected ? c.focus() : c;
  } catch {
    return c; // no view (not mounted): nothing to focus
  }
}

export const LANGUAGE_CODES = ["en", "de", "fr", "it", "la"] as const;
export type ForeignLanguage = (typeof LANGUAGE_CODES)[number];
export const isBoxKind = (value: string): value is BoxKind => (BOX_KINDS as readonly string[]).includes(value);
export const isCodeLanguage = (value: string): value is CodeLanguage => (CODE_LANGUAGES as readonly string[]).includes(value);

/** What the formula dialog edits: a formula selected as an atom, or a new one. */
export type FormulaTarget = { inline: boolean; tex: string; editing: boolean };

export function formulaTarget(editor: Editor, inline: boolean): FormulaTarget {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    const name = selection.node.type.name;
    if (name === "formula") return { inline: false, tex: String(selection.node.attrs.tex ?? ""), editing: true };
    if (name === "inlineFormula") return { inline: true, tex: String(selection.node.attrs.tex ?? ""), editing: true };
  }
  return { inline, tex: "", editing: false };
}

export function saveFormula(editor: Editor, target: FormulaTarget, tex: string): boolean {
  if (target.editing) {
    if (target.inline) return chain(editor).insertInlineFormula(tex).run();
    return chain(editor).updateBlockAtom({ tex }).run();
  }
  return target.inline ? chain(editor).insertInlineFormula(tex).run() : chain(editor).insertFormula(tex).run();
}

export function removeFormula(editor: Editor): boolean {
  return chain(editor).deleteSelection().run();
}

export function insertCodeBlock(editor: Editor, language: CodeLanguage | null = null): boolean {
  return chain(editor).setCodeBlock(language).run();
}

export const codeBlockActive = (editor: Editor): boolean => editor.isActive("codeBlock");
export const setCodeLanguage = (editor: Editor, language: CodeLanguage | null): boolean =>
  chain(editor).setCodeBlockLanguage(language).run();
export const setCodeCaption = (editor: Editor, caption: string): boolean =>
  chain(editor).setCodeBlockCaption(caption === "" ? null : caption).run();

/** A box of `kind` round the paragraph(s) of the selection, or the kind of the box the cursor is in changed. */
export function applyBox(editor: Editor, kind: BoxKind): boolean {
  const c = chain(editor);
  return (editor.isActive("box") ? c.setBoxKind(kind) : c.wrapBox(kind)).run();
}
export const removeBox = (editor: Editor): boolean => chain(editor).unwrapBox().run();
export const boxActive = (editor: Editor): BoxKind | null => {
  const kind = editor.getAttributes("box").kind;
  return typeof kind === "string" && isBoxKind(kind) ? kind : null;
};

/** The mark `lang` on a non-empty selection; false (and the caller asks for a selection) on an empty one. */
export function applyLanguage(editor: Editor, language: ForeignLanguage | null): boolean {
  if (language !== null && editor.state.selection.empty) return false;
  const c = chain(editor);
  return (language === null ? c.unsetLang() : c.setLang(language)).run();
}
