// WEB-NF6-RUNDA (NF-6 MK-9): the place of the cursor kept with "Poruka sebi" (block id and offset) and the
// way back to it, read from and applied to the open editor. Pure over a minimal editor shape.
import type { NotePlace } from "../../../../../../src/client/sealed-self-note/codec";
import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";

type Block = {
  readonly attrs: Record<string, unknown>; readonly isTextblock: boolean; readonly content: { readonly size: number };
};
type Doc = { descendants(fn: (node: Block, pos: number) => boolean | void): void };
export type PlaceEditor = {
  readonly state: { readonly doc: Doc; readonly selection: { readonly $from: { readonly parent: Block; readonly parentOffset: number } } };
};

/** The block and offset of the cursor; null outside a text block with an id. */
export function placeOf(editor: PlaceEditor): NotePlace | null {
  const { parent, parentOffset } = editor.state.selection.$from;
  const id = parent.attrs[NODE_ID_ATTRIBUTE];
  return parent.isTextblock && typeof id === "string" ? { nodeId: id, offset: parentOffset } : null;
}

/** The document position of a kept place, clamped to its block; null when the block is gone. */
export function positionOf(doc: Doc, place: NotePlace): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.attrs[NODE_ID_ATTRIBUTE] === place.nodeId) { found = pos + 1 + Math.min(place.offset, node.content.size); return false; }
    return undefined;
  });
  return found;
}
