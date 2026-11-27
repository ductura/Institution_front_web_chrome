/**
 * ED-92: "Umetni › Navod / Novi izvor" and the same palette items. Navod opens the source list at the caret (as
 * "@"); Novi izvor opens the quick source dialog of "@ › Dodaj novi izvor…" (prototype `quick`). Both live with
 * the "@" menu (SourcesMention), so a menu elsewhere on the page asks for them.
 */
import type { Editor } from "@tiptap/core";

import { requestPanel } from "@/components/editor/layout-prefs/open-panel";
import { requestCiteAtCaret } from "@/components/editor/triggers/TriggerPopover";

export const NEW_SOURCE_REQUEST = "ductura:source-new";

/** Asks the open work's quick source dialog to open; false when nothing on the page took it. */
export function requestNewSource(target: EventTarget = document): boolean {
  return !target.dispatchEvent(new CustomEvent(NEW_SOURCE_REQUEST, { cancelable: true }));
}

/**
 * Runs Navod or Novi izvor for `editor`. It waits until the menu that asked has closed and given the focus back,
 * then Navod puts the caret after the selection in the focused text (the list at the caret opens only there).
 * A page with no sources menu opens the Literatura panel instead, so the item never does nothing.
 */
export function insertSourceAction(editor: Editor, id: "cite" | "newSource", target: EventTarget = document): void {
  setTimeout(() => {
    if (editor.isDestroyed || !editor.isEditable) return;
    let taken: boolean;
    if (id === "cite") {
      editor.chain().focus().setTextSelection(editor.state.selection.to).run();
      taken = requestCiteAtCaret(editor, target);
    } else taken = requestNewSource(target);
    if (!taken) requestPanel("sources", target);
  }, 0);
}
