/** Pure rules of the context menu (prototype #pop, INVENTAR more2 "Izbornik na desni klik"). */

export type MenuEntry =
  | { kind: "heading"; label: string }
  | { kind: "item"; id: string; label: string; /** Shortcut or note on the right ("Ctrl+C"). */ hint?: string; disabled?: boolean };

export type Point = { x: number; y: number };

/** The entries that can take the focus: items that are not disabled. */
export function enabledIndexes(entries: readonly MenuEntry[]): number[] {
  return entries.flatMap((entry, index) => (entry.kind === "item" && !entry.disabled ? [index] : []));
}

/** Arrow keys, Home and End: the entry index to focus, or null for any other key. Wraps; disabled items are skipped. */
export function menuFocusTarget(entries: readonly MenuEntry[], current: number, key: string): number | null {
  const enabled = enabledIndexes(entries);
  if (enabled.length === 0) return null;
  const first = enabled[0] ?? null;
  const last = enabled[enabled.length - 1] ?? null;
  if (key === "Home") return first;
  if (key === "End") return last;
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const at = enabled.indexOf(current);
  if (at === -1) return key === "ArrowDown" ? first : last;
  const step = key === "ArrowDown" ? 1 : -1;
  return enabled[(at + step + enabled.length) % enabled.length] ?? null;
}

/** Right click at the pointer; Shift+F10 or the menu key at the element's own corner. Shift+right click is the browser's own menu. */
export function menuOpensFor(event: { shiftKey: boolean; pointerType?: string }, fromKeyboard: boolean): boolean {
  if (fromKeyboard) return true;
  if (event.shiftKey) return false;
  return event.pointerType === undefined || event.pointerType === "" || event.pointerType === "mouse";
}

/** Keeps the menu fully on screen: flips to the other side of the point, then clamps with a margin. */
export function placeMenu(anchor: Point, size: { width: number; height: number }, viewport: { width: number; height: number }, margin = 8): Point {
  const fit = (at: number, length: number, room: number) => {
    const start = at + length + margin > room ? at - length : at;
    return Math.max(margin, Math.min(start, room - length - margin));
  };
  return { x: fit(anchor.x, size.width, viewport.width), y: fit(anchor.y, size.height, viewport.height) };
}

export function isMenuKey(event: { key: string; shiftKey: boolean }): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}
