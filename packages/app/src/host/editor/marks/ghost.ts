// ED-45 (P2-17, dio 3): the ghost text of an empty paragraph, as in the prototype (app.js `ghostText`).
// While the cursor stands in an empty top-level paragraph of a text that can be written, a quiet hint
// in that paragraph says what the chapter around it usually holds. It is a decoration only: it never
// enters the document, the export, the print or a submission, and it goes once the person types.
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { marksHr as t } from "./messages.hr";

export const GHOST_KEY = new PluginKey("ductusGhost");

/** The hint for a paragraph under a chapter with this title ("" before the first chapter). */
export function ghostText(title: string): string {
  const name = title.trim();
  if (name === "") return t.ghost.start;
  if (/uvod/i.test(name)) return t.ghost.intro;
  if (/zaklju/i.test(name)) return t.ghost.conclusion;
  return t.ghost.chapter(name);
}

/** Where the ghost stands now and what it says, or null: the cursor alone in an empty top-level paragraph. */
export function ghostAt(state: EditorState, editable: boolean): { pos: number; size: number; text: string } | null {
  const { selection, doc } = state;
  if (!editable || !selection.empty) return null;
  const $at = selection.$from;
  if ($at.depth !== 1) return null;
  const node = $at.parent;
  if (node.type.name !== "paragraph" || node.content.size !== 0) return null;
  const pos = $at.before(1);
  return { pos, size: node.nodeSize, text: ghostText(chapterBefore(doc, pos)) };
}

/** The title of the chapter (a heading of level 1 or 2) the position falls under. */
function chapterBefore(doc: PmNode, pos: number): string {
  let title = "";
  doc.forEach((node, offset) => {
    if (offset < pos && node.type.name === "heading" && Number(node.attrs.level) <= 2) title = node.textContent;
  });
  return title;
}

/** Register with `editor.registerPlugin`; `editable` is read on every draw, so a submitted work shows none. */
export function ghostPlugin(editable: () => boolean, className: string) {
  return new Plugin({
    key: GHOST_KEY,
    props: {
      decorations(state) {
        const at = ghostAt(state, editable());
        return at ? DecorationSet.create(state.doc, [Decoration.node(at.pos, at.pos + at.size, { class: className, "data-ghost": at.text })]) : null;
      },
    },
  });
}
