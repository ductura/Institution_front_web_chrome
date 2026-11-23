// PIL-D8-PRECACI (P-D8): which key opens the editor's shortcut list from the host.
// "?" outside a text field only: "?" typed in the text, an input or a textarea is text.
// Ctrl/Cmd+/ stays with the editor commands (src/components/editor/commands), which already
// toggle their own list on it; answering it here as well would open two dialogs.
import { opensShortcutList } from "@ductura/ui";

export type ListKeyEvent = Parameters<typeof opensShortcutList>[0];

export function opensEditorShortcutList(event: ListKeyEvent): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  return opensShortcutList(event);
}
