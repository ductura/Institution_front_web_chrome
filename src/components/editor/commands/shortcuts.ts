import { shortcutDialogGroups } from "./shortcut-definitions";

export function editorShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.repeat || event.shiftKey) return null;
  const mod = event.ctrlKey || event.metaKey;
  if (!mod && event.altKey && event.key === "F10") return "toolbar";
  if (!mod || event.altKey) return null;
  if (event.key.toLowerCase() === "k") return "palette";
  if (event.key === "/") return "shortcuts";
  if (event.key.toLowerCase() === "f") return "find";
  return null;
}

/** The editor's list: the one definition (shortcut-definitions.ts), Ctrl written for both platforms. */
export function shortcutGroups(editable: boolean) {
  return shortcutDialogGroups(editable);
}