// WEB-V20-NAGLAS-UREDNIK: which text is read (paragraph, selection, whole work) and the decoration that marks the
// sentence being read. Reading only: nothing here changes the document (the decoration lives in plugin state and
// is set with a meta-only transaction, which has no steps and so never reaches the journal).
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type ReadScope = "paragraph" | "selection" | "work";

/** One run of text node characters: `text[textStart, textStart+length)` lives at document position `pos`. */
export type TextRun = { textStart: number; pos: number; length: number };
export type ReadSource = { text: string; runs: TextRun[] };

export const READ_ALOUD_KEY = new PluginKey<DecorationSet>("ductusReadAloud");
export const READ_ALOUD_CLASS = "ductus-read-aloud";

/** Text of [from,to) with a line break between blocks, and the map back to document positions. */
export function sourceOfRange(doc: PMNode, from: number, to: number): ReadSource {
  const runs: TextRun[] = [];
  let text = "";
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      if (end <= start) return;
      const piece = (node.text ?? "").slice(start - pos, end - pos);
      runs.push({ textStart: text.length, pos: start, length: piece.length });
      text += piece;
      return;
    }
    if (node.isTextblock) {
      if (text && !text.endsWith("\n")) text += "\n";
    }
  });
  return { text: text.replace(/\n+$/, ""), runs };
}

/** The range the scope reads, or null when the selection scope has nothing selected. */
export function scopeRange(state: EditorState, scope: ReadScope): { from: number; to: number } | null {
  const { doc, selection } = state;
  if (scope === "work") return { from: 0, to: doc.content.size };
  if (scope === "selection") return selection.empty ? null : { from: selection.from, to: selection.to };
  const $pos = selection.$from;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).isTextblock) return { from: $pos.start(depth), to: $pos.end(depth) };
  }
  return null;
}

export const sourceOfScope = (state: EditorState, scope: ReadScope): ReadSource | null => {
  const range = scopeRange(state, scope);
  return range ? sourceOfRange(state.doc, range.from, range.to) : null;
};

/** Maps [start,end) of the read text to document positions (first and last run it touches), or null. */
export function docRangeOf(source: ReadSource, start: number, end: number): { from: number; to: number } | null {
  let from: number | null = null;
  let to: number | null = null;
  for (const run of source.runs) {
    const runEnd = run.textStart + run.length;
    if (runEnd <= start || run.textStart >= end) continue;
    if (from === null) from = run.pos + Math.max(0, start - run.textStart);
    to = run.pos + Math.min(run.length, end - run.textStart);
  }
  return from !== null && to !== null && to > from ? { from, to } : null;
}

type HighlightMeta = { from: number; to: number } | null;

/** Plugin with the "sentence being read" decoration. Register with `editor.registerPlugin`. */
export function readAloudPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: READ_ALOUD_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const meta = tr.getMeta(READ_ALOUD_KEY) as HighlightMeta | undefined;
        if (meta === null) return DecorationSet.empty;
        if (meta) {
          const size = tr.doc.content.size;
          if (meta.from < 0 || meta.to > size || meta.to <= meta.from) return DecorationSet.empty;
          return DecorationSet.create(tr.doc, [Decoration.inline(meta.from, meta.to, { class: READ_ALOUD_CLASS, "data-read-aloud": "", style: "background: var(--accent-soft); border-radius: 2px;" })]);
        }
        return set.map(tr.mapping, tr.doc);
      },
    },
    props: { decorations: (state) => READ_ALOUD_KEY.getState(state) },
  });
}

/** Sets or clears the highlight. A meta-only transaction: the document does not change. */
export function setReadHighlight(
  editor: { state: EditorState; view: { dispatch(tr: ReturnType<EditorState["tr"]["setMeta"]>): void }; isDestroyed: boolean },
  range: { from: number; to: number } | null,
): void {
  if (editor.isDestroyed || !READ_ALOUD_KEY.getState(editor.state)) return;
  editor.view.dispatch(editor.state.tr.setMeta(READ_ALOUD_KEY, range).setMeta("addToHistory", false));
}
