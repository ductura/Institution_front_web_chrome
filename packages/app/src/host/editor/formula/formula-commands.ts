// WEB-V21-STEM-FORMULA-UREDNIK: inserting and changing a formula node. The result is always a valid v4
// node (`formula` with `tex`, or `inlineFormula` with `tex`); a formula over the schema limit, an empty
// one or one in a schema without the node is refused (returns false) and the document is untouched.
import type { Editor } from "@tiptap/core";

import { checkFormulaLimit, type FormulaKind } from "./limits.ts";
import { FORMULA_NODE, formulaAt } from "./formula-view.ts";

/** Same tidying as the schema's own commands: a line break becomes a space, ends trimmed. */
export function tidyTex(tex: string): string {
  return tex.replace(/\r\n|[\r\n]/g, " ").replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
}

/** A `%` comment (not `\\%`) that a line break ends: turning that break into a space would comment out the rest. */
export function hasCommentBeforeBreak(tex: string): boolean {
  return /(^|[^\\])%[^\r\n]*[\r\n]/u.test(tex.trim());
}

const live = (editor: Editor | null | undefined): editor is Editor => !!editor && !editor.isDestroyed && editor.isEditable;

export function insertFormula(editor: Editor | null | undefined, kind: FormulaKind, tex: string): boolean {
  if (!live(editor) || !editor.schema.nodes[FORMULA_NODE[kind]]) return false;
  const tidy = tidyTex(tex);
  if (!checkFormulaLimit(tidy, kind).ok || hasCommentBeforeBreak(tex)) return false;
  return kind === "block" ? editor.commands.insertFormula(tidy) : editor.commands.insertInlineFormula(tidy);
}

/** Changes the formula node at `pos` in place; false when no formula of that kind stands there. */
export function updateFormula(editor: Editor | null | undefined, pos: number, kind: FormulaKind, tex: string): boolean {
  if (!live(editor)) return false;
  const tidy = tidyTex(tex);
  if (!checkFormulaLimit(tidy, kind).ok || hasCommentBeforeBreak(tex)) return false;
  const target = formulaAt(editor.state.doc, pos);
  if (!target || target.kind !== kind) return false;
  const node = editor.state.doc.nodeAt(pos)!;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, tex: tidy }));
  return true;
}
