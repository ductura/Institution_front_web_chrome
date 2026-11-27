/**
 * ED-93: Ctrl+Alt+M (Cmd+Alt+M on a Mac) starts a comment on the selected text, as the tool tip and the
 * right-click menu say. It goes the way of the chapter sheet's "Pitaj mentora": the Komentari panel opens and
 * its card asks for the new comment on the selection. Without a selection it only says what to do.
 */
import type { Editor } from "@tiptap/core";

import { requestPanel } from "@/components/editor/layout-prefs/open-panel";

import { askComment } from "../comments/ask-comment";
import { keyAction } from "./toolbar-keys";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform ?? "");

/** Answers the key on `editor`'s text; true when it was the comment key. `say` tells a missing selection. */
export function commentKey(editor: Editor, event: KeyboardEvent, say: () => void, target: EventTarget = document, mac = IS_MAC): boolean {
  if (keyAction(event, mac) !== "comment") return false;
  event.preventDefault();
  if (editor.state.selection.empty) { say(); return true; }
  requestPanel("comments", target);
  askComment("", target);
  return true;
}

/** Listens for the comment key on the editor's text; returns the way to stop. */
export function listenCommentKey(editor: Editor, say: () => void): () => void {
  const dom = editor.view.dom;
  const onKey = (event: KeyboardEvent) => { commentKey(editor, event, say); };
  dom.addEventListener("keydown", onKey);
  return () => dom.removeEventListener("keydown", onKey);
}
