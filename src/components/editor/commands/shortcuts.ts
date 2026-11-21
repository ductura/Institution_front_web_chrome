import { DEFAULT_SHORTCUT_GROUPS } from "@ductura/ui";
import { editorCommandsHr as t } from "./messages.hr";

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

const available = new Set(["Ctrl+Z", "Ctrl+Y", "Ctrl+B", "Ctrl+I", "Ctrl+K", "Ctrl+F", "Ctrl+/", "Esc"]);

export function shortcutGroups(editable: boolean) {
  return DEFAULT_SHORTCUT_GROUPS.map(({ title, items }, index) => ({
    title,
    items: [
      ...items.filter(({ keys }) => available.has(keys) && (index !== 0 || editable)),
      ...(index === 1 ? [{ keys: "Alt+F10", label: t.toolbarKeys }] : []),
    ],
  })).filter(({ items }) => items.length > 0);
}
