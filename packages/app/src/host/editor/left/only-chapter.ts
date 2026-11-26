// ED-48 (P2-24, prototype features.js `hOnly`/`showAll`): "Prikaži samo ovo poglavlje" hides every top-level
// block outside one chapter (its heading up to the next heading of the same or a higher level). A view only: the
// hiding is a node decoration in plugin state, set with a meta-only transaction, so the document, the journal,
// the export and the submission never see it. The chapter is found again on every change, so it follows edits;
// when its heading is gone the whole work shows again.
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { headingPosition } from "../../../../../editor-core/src/outline/index.ts";

type OnlyState = { key: string | null; set: DecorationSet };

export const ONLY_CHAPTER_KEY = new PluginKey<OnlyState>("ductusOnlyChapter");
export const ONLY_CHAPTER_HIDDEN = "only-chapter-hidden";

/** [start, end) of the chapter whose heading starts at `pos`: up to the next heading of the same or a higher level. */
export function chapterRange(doc: PMNode, pos: number): { start: number; end: number } | null {
  const heading = doc.nodeAt(pos);
  if (!heading || heading.type.name !== "heading") return null;
  const level = Number(heading.attrs.level);
  let end = doc.content.size;
  let found = false;
  doc.forEach((node, offset) => {
    if (!found && offset > pos && node.type.name === "heading" && Number(node.attrs.level) <= level) { end = offset; found = true; }
  });
  return { start: pos, end };
}

function build(state: EditorState, key: string | null): OnlyState {
  if (key === null) return { key: null, set: DecorationSet.empty };
  const pos = headingPosition(state, key);
  const range = pos === null ? null : chapterRange(state.doc, pos);
  if (!range) return { key: null, set: DecorationSet.empty };
  const hidden: Decoration[] = [];
  state.doc.forEach((node, offset) => {
    if (offset < range.start || offset >= range.end) {
      hidden.push(Decoration.node(offset, offset + node.nodeSize, { class: ONLY_CHAPTER_HIDDEN, style: "display: none", "aria-hidden": "true" }));
    }
  });
  return { key, set: DecorationSet.create(state.doc, hidden) };
}

/** Register with `editor.registerPlugin`; unregistering shows the whole work again. */
export function onlyChapterPlugin(): Plugin<OnlyState> {
  return new Plugin<OnlyState>({
    key: ONLY_CHAPTER_KEY,
    state: {
      init: () => ({ key: null, set: DecorationSet.empty }),
      apply(tr, value, _old, next) {
        const meta = tr.getMeta(ONLY_CHAPTER_KEY) as { key: string | null } | undefined;
        if (meta) return build(next, meta.key);
        return tr.docChanged && value.key !== null ? build(next, value.key) : value;
      },
    },
    props: { decorations: (state) => ONLY_CHAPTER_KEY.getState(state)?.set },
  });
}

/** The heading key of the chapter shown alone, or null when the whole work shows. */
export const onlyChapterKey = (state: EditorState): string | null => ONLY_CHAPTER_KEY.getState(state)?.key ?? null;

/** Shows one chapter alone (`key`) or the whole work (null). A meta-only transaction: the document does not change. */
export function showOnlyChapter(
  editor: { state: EditorState; view: { dispatch(tr: ReturnType<EditorState["tr"]["setMeta"]>): void }; isDestroyed: boolean },
  key: string | null,
): void {
  if (editor.isDestroyed || !ONLY_CHAPTER_KEY.getState(editor.state)) return;
  editor.view.dispatch(editor.state.tr.setMeta(ONLY_CHAPTER_KEY, { key }).setMeta("addToHistory", false));
}
