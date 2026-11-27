// ED-97 (prototype right.js ctx: ch, a, b): the chapter the cursor is in, a level 2 heading up to the next one.
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { useEffect, useState } from "react";

import type { ChapterScope } from "./CommentsPanel";

const same = (a: ChapterScope, b: ChapterScope) => a === b || (a !== null && b !== null && a.title === b.title && a.from === b.from && a.to === b.to);

/** The chapter under the cursor, kept as the text and the cursor move. */
export function useChapterScope(editor: Editor | null): ChapterScope {
  const read = (): ChapterScope => (editor && !editor.isDestroyed ? chapterAt(editor.state.doc, editor.state.selection.from) : null);
  const [chapter, setChapter] = useState(read);
  useEffect(() => {
    setChapter(read);
    // A host may hand a bare view of the text (state only, no events): the chapter is then read once.
    if (!editor || editor.isDestroyed || typeof editor.on !== "function") return;
    const update = () => setChapter((prev) => { const next = read(); return same(prev, next) ? prev : next; });
    editor.on("transaction", update);
    return () => { editor.off("transaction", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return chapter;
}

export function chapterAt(doc: PmNode, pos: number): ChapterScope {
  const heads: { from: number; title: string }[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "heading" && node.attrs.level === 2) heads.push({ from: offset, title: `${heads.length + 1}. ${node.textContent.trim()}` });
  });
  for (let i = heads.length - 1; i >= 0; i -= 1) {
    const head = heads[i]!;
    if (pos >= head.from) return { title: head.title, from: head.from, to: heads[i + 1]?.from ?? doc.content.size };
  }
  return null;
}
