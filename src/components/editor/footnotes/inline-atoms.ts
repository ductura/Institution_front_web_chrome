import type { Attrs, Schema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

export type AcademicAtom = "footnote" | "crossReference";

export function supportsAcademicAtoms(schema: Schema, confirmedWorkSchemaVersion: number | undefined): boolean {
  const { footnote, crossReference } = schema.nodes;
  return confirmedWorkSchemaVersion === 3 && !!footnote?.isInline && footnote.isAtom
    && !!crossReference?.isInline && crossReference.isAtom;
}

export function insertAcademicAtom(
  state: EditorState, version: number | undefined, kind: AcademicAtom, attrs: Attrs,
): Transaction | null {
  if (!supportsAcademicAtoms(state.schema, version)) return null;
  const { $from, $to } = state.selection;
  const type = state.schema.nodes[kind];
  if (!type || !$from.sameParent($to) || $from.parent.type.name === "heading"
    || !$from.parent.canReplaceWith($from.index(), $to.index(), type)) return null;
  const tr = state.tr.replaceSelectionWith(type.create(attrs), false);
  return tr.docChanged ? tr : null;
}
