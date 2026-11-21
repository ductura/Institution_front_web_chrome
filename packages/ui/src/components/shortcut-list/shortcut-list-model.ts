// WEB-1908 (P-D8): the data side of the shortcut list, free of React so it can be tested alone.

export type ShortcutEntry = {
  /** Same id as the editor command the shortcut belongs to. */
  id: string;
  label: string;
  /** Display form, e.g. "Ctrl+Z" or "Alt+↑ ili ↓". */
  keys: string;
};
export type ShortcutListGroup = { id: string; title: string; items: readonly ShortcutEntry[] };

const SPOKEN: Readonly<Record<string, string>> = {
  Ctrl: "Control", Cmd: "Command", Alt: "Alt", Shift: "Shift", Esc: "Escape",
  "/": "kosa crta", ".": "točka", "\\": "obrnuta kosa crta", "@": "znak at",
  "↑": "strelica gore", "↓": "strelica dolje",
};

/** What a screen reader says for a chord: "Ctrl+Z" reads as "Control plus Z". */
export function spokenKeys(keys: string): string {
  return keys
    .split(" ")
    .map((part) => part.split("+").map((key) => SPOKEN[key] ?? key).join(" plus "))
    .join(" ");
}

/** Groups without items are not shown; a list without any group is empty. */
export function visibleGroups(groups: readonly ShortcutListGroup[]): ShortcutListGroup[] {
  return groups.filter((group) => group.items.length > 0);
}

/** "?" (outside a text field) or Ctrl/Cmd+/ asks for the list. */
export function opensShortcutList(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing" | "defaultPrevented" | "target">): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey) return false;
  if ((event.ctrlKey || event.metaKey) && event.key === "/") return true;
  if (event.key !== "?" || event.ctrlKey || event.metaKey) return false;
  const target = event.target as HTMLElement | null;
  return !(target?.isContentEditable || /^(input|textarea|select)$/iu.test(target?.tagName ?? ""));
}
