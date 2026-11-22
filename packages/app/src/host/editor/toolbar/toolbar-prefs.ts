// WEB-2131: what a person set on the toolbar (S.tb in the prototype): the look of the buttons, which tools are
// in the "Više" menu and the order of the rest. Kept in this browser only; a stored value that does not fit is
// ignored so the toolbar never fails to draw. The toolbar's right-hand side and the block style cannot be rearranged.
import type { EditorToolbarGroup } from "@ductura/ui";

export type ToolbarLook = "icons" | "both" | "words";
export type ToolbarPrefs = { look: ToolbarLook; off: string[]; order: string[] };

export const DEFAULT_PREFS: ToolbarPrefs = { look: "icons", off: [], order: [] };
export const PREFS_KEY = "ductura.toolbar.prefs.v1";
/** The group that is the paragraph style (a menu in the prototype); it is never rearranged or moved to Više. */
export const FIXED_GROUP = "block";

const LOOKS: readonly ToolbarLook[] = ["icons", "both", "words"];
const ids = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64))].slice(0, 64) : [];

/** Reads any stored value; anything unusable falls back to the default. */
export function sanitizePrefs(value: unknown): ToolbarPrefs {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_PREFS };
  const raw = value as Record<string, unknown>;
  const look = LOOKS.find((l) => l === raw["look"]) ?? "icons";
  return { look, off: ids(raw["off"]), order: ids(raw["order"]) };
}

export function loadPrefs(storage: Pick<Storage, "getItem"> | null = safeStorage()): ToolbarPrefs {
  try {
    const raw = storage?.getItem(PREFS_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: ToolbarPrefs, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the choice then holds for this visit only.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The tools a person may arrange: every action outside the paragraph style, in the order the toolbar draws them. */
export function customisableIds(groups: readonly EditorToolbarGroup[]): string[] {
  return groups.filter((g) => g.id !== FIXED_GROUP).flatMap((g) => g.actions.map((a) => a.id));
}

/** The arranged order: the stored order first (unknown ids dropped), tools it does not know follow in the default order. */
export function arrangedIds(base: readonly string[], prefs: ToolbarPrefs): string[] {
  const known = new Set(base);
  const first = prefs.order.filter((id) => known.has(id));
  return [...first, ...base.filter((id) => !first.includes(id))];
}

export type ArrangedToolbar = { groups: EditorToolbarGroup[]; more: EditorToolbarGroup["actions"][number][] };

/**
 * The groups to draw and the tools that went to "Više". Groups keep their place; inside a group the tools follow
 * the arranged order; a tool in `off` (and, in `collapsed`, one that does not fit the width) goes to `more`.
 */
export function arrangeToolbar(groups: readonly EditorToolbarGroup[], prefs: ToolbarPrefs, collapsed: readonly string[] = []): ArrangedToolbar {
  const order = arrangedIds(customisableIds(groups), prefs);
  const rank = (id: string) => order.indexOf(id);
  const hidden = new Set([...prefs.off, ...collapsed]);
  const more: ArrangedToolbar["more"] = [];
  const drawn: EditorToolbarGroup[] = [];
  for (const group of groups) {
    if (group.id === FIXED_GROUP) {
      drawn.push(group);
      continue;
    }
    const sorted = [...group.actions].sort((a, b) => rank(a.id) - rank(b.id));
    const shown = sorted.filter((a) => !hidden.has(a.id));
    more.push(...sorted.filter((a) => hidden.has(a.id)));
    if (shown.length > 0) drawn.push({ ...group, actions: shown });
  }
  more.sort((a, b) => rank(a.id) - rank(b.id));
  return { groups: drawn, more };
}

/** Moves one tool a place left (-1) or right (1) in the arranged order; at the end nothing changes. */
export function moveTool(base: readonly string[], prefs: ToolbarPrefs, id: string, direction: -1 | 1): ToolbarPrefs {
  const order = arrangedIds(base, prefs);
  const at = order.indexOf(id);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= order.length) return prefs;
  [order[at], order[to]] = [order[to]!, order[at]!];
  return { ...prefs, order };
}

/** Switches a tool between the toolbar and "Više". */
export function toggleTool(prefs: ToolbarPrefs, id: string): ToolbarPrefs {
  return { ...prefs, off: prefs.off.includes(id) ? prefs.off.filter((o) => o !== id) : [...prefs.off, id] };
}

export const setLook = (prefs: ToolbarPrefs, look: ToolbarLook): ToolbarPrefs => ({ ...prefs, look });
/** "Vrati zadano": order and Više are cleared; the look goes back too (S.tb = {off:[], order:{}}). */
export const resetPrefs = (): ToolbarPrefs => ({ ...DEFAULT_PREFS });
