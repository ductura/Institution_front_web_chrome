import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { isSearchableText } from "@/domain/text/find-literal";
import { MAX_REPLACE_ALL, searchDocument, type SearchMatch } from "@/editor";

type EditorDoc = Editor["state"]["doc"];
export type FindScope = "all" | "chapter" | "quote";

export const findHighlights = new PluginKey<DecorationSet>("editorFindHighlights");

export function highlightPlugin() {
  return new Plugin({
    key: findHighlights,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, previous) => {
        const next: unknown = tr.getMeta(findHighlights);
        return next instanceof DecorationSet ? next : previous.map(tr.mapping, tr.doc);
      },
    },
    props: { decorations: (state) => findHighlights.getState(state) },
  });
}

export function highlightHits(doc: EditorDoc, hits: readonly SearchMatch[], current: number, classes: readonly [string, string]) {
  return DecorationSet.create(doc, hits.map(({ from, to }, index) =>
    Decoration.inline(from, to, { class: classes[index === current ? 1 : 0] })),
  );
}

export function searchWork(doc: EditorDoc, query: string, scope: FindScope, caret: number) {
  const literal = { text: query, matchCase: false };
  if (!isSearchableText(query)) return null;
  if (scope === "chapter") {
    let start = 0;
    let end = doc.content.size;
    doc.forEach((node, pos) => {
      if (node.type.name !== "heading" || node.attrs.level > 2) return;
      if (pos < caret) start = pos;
      else end = Math.min(end, pos);
    });
    // Search inside the chapter before applying the core's match limit.
    const chapter = searchDocument(doc.copy(doc.content.cut(start, end)), literal);
    return chapter && { ...chapter, doc, matches: chapter.matches.map((match) => ({
      ...match, from: match.from + start, to: match.to + start,
    })) };
  }
  if (scope === "all") return searchDocument(doc, literal);
  const matches: SearchMatch[] = [];
  let overLimit = false;
  doc.forEach((block, pos) => {
    if (overLimit || !block.isTextblock || !query) return;
    const text = block.textBetween(0, block.content.size, "", "\uFFFC");
    const ranges = block.type.name === "quote" ? [[0, block.content.size]]
      : Array.from(text.matchAll(/„[^„”]*”/gu), (part) => [part.index + 1, part.index + part[0].length - 1]);
    for (const [from = 0, to = 0] of ranges) {
      const slice = doc.content.cut(pos, pos + block.nodeSize).replaceChild(0, block.cut(from, to));
      const result = searchDocument(doc.copy(slice), literal);
      if (!result) continue;
      const room = MAX_REPLACE_ALL - matches.length;
      const offset = pos + from;
      matches.push(...result.matches.slice(0, room).map((hit) => ({
        ...hit, from: hit.from + offset, to: hit.to + offset,
      })));
      overLimit = result.overLimit || result.matches.length > room;
      if (overLimit) break;
    }
  });
  return { doc, query: literal, matches, overLimit };
}

export function rangeOf(editor: Editor, { from, to }: SearchMatch) {
  const start = editor.view.domAtPos(from, 1);
  const end = editor.view.domAtPos(to, -1);
  const range = editor.view.dom.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
