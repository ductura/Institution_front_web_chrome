import type { useLocalEditor } from "@/components/editor/LocalDocument";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;

/** Puts the cursor in the block at `pos` (a position of the document when it was read, checked again now). */
export function jumpToBlock(editor: Editor, pos: number): boolean {
  if (editor.isDestroyed || pos < 0 || pos >= editor.state.doc.content.size) return false;
  editor.chain().setTextSelection(pos + 1).scrollIntoView().run();
  editor.view.focus();
  return true;
}
