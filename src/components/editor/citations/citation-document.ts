import { Fragment } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { isAllowedText } from "@/domain/document/forbidden";
import { isSourceId, MAX_CITATION_LOCATOR_CODE_POINTS } from "@/domain/document/schema";
import { CITATION } from "@/editor";

export function validCitationPage(page: string) {
  return page === "" || isAllowedText(page, MAX_CITATION_LOCATOR_CODE_POINTS);
}

export function citationRange(state: EditorState) {
  const { selection } = state;
  const { $from, $to } = selection;
  const type = state.schema.nodes[CITATION];
  if (!(selection instanceof TextSelection) || !type || !$from.sameParent($to) ||
      !$from.parent.isTextblock || !$from.parent.canReplaceWith($from.index(), $to.index(), type)) return null;
  return { doc: state.doc, from: $from.pos, to: $to.pos };
}

export function insertCitation(state: EditorState, saved: NonNullable<ReturnType<typeof citationRange>>,
  sourceId: string, page: string) {
  const range = citationRange(state);
  const type = state.schema.nodes[CITATION];
  if (!range || !type || range.doc !== saved.doc || range.from !== saved.from || range.to !== saved.to ||
      !isSourceId(sourceId) || !validCitationPage(page)) return null;

  const citation = type.create({ sourceId, locator: page === "" ? null : page });
  const tr = state.tr.replaceWith(range.from, range.to, Fragment.fromArray([citation, state.schema.text(" ")]));
  return tr.setSelection(TextSelection.create(tr.doc, range.from + citation.nodeSize + 1)).scrollIntoView();
}
