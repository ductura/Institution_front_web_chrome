export const LAYOUTS = ["a", "b", "c"] as const;
export type PanelLayout = (typeof LAYOUTS)[number];
export type MobileLayout = PanelLayout | "same";
export type Side = "left" | "right";
/** ED-37 (P2-6): what a chapter row can show after its title ("U retku poglavlja"). */
export const ROW_PARTS = ["words", "status", "flags"] as const;
export type RowPart = (typeof ROW_PARTS)[number];
/**
 * `dense` (ED-39, "Gustoća: Zbijeno") is kept only when chosen; without it the side is "Prozračno".
 * `hideRow` (ED-37) lists the row parts switched off, in ROW_PARTS order; without it the row shows all.
 */
export type LayoutPreferences = Record<Side, { layout: PanelLayout; mobile: MobileLayout; dense?: true; hideRow?: RowPart[] }>;

export const DEFAULT_PREFERENCES: LayoutPreferences = {
  left: { layout: "a", mobile: "c" },
  right: { layout: "a", mobile: "same" },
};

export const PREFERENCES_KEY = "ductura.editor.panel-layouts";

export function isPanelLayout(value: unknown): value is PanelLayout {
  return value === "a" || value === "b" || value === "c";
}

function readSide(side: Side, value: unknown): LayoutPreferences[Side] {
  const defaults = DEFAULT_PREFERENCES[side];
  if (typeof value !== "object" || value === null) return defaults;
  const { layout, mobile, dense, hideRow } = value as Record<string, unknown>;
  const hidden = Array.isArray(hideRow) ? ROW_PARTS.filter((part) => hideRow.includes(part)) : [];
  return {
    layout: isPanelLayout(layout) ? layout : defaults.layout,
    mobile: mobile === "same" || isPanelLayout(mobile) ? mobile : defaults.mobile,
    ...(dense === true ? { dense: true as const } : {}),
    ...(hidden.length > 0 ? { hideRow: hidden } : {}),
  };
}

/** The side with one row part switched on or off; an empty list is dropped, so the default stays "show all". */
export function withRowPart(value: LayoutPreferences[Side], part: RowPart, shown: boolean): LayoutPreferences[Side] {
  const { hideRow, ...rest } = value;
  const hidden = ROW_PARTS.filter((p) => (p === part ? !shown : hideRow?.includes(p) ?? false));
  return hidden.length > 0 ? { ...rest, hideRow: hidden } : rest;
}

/** What a chapter row shows under these preferences. */
export function rowShows(value: LayoutPreferences[Side]): Record<RowPart, boolean> {
  const off = (part: RowPart) => value.hideRow?.includes(part) ?? false;
  return { words: !off("words"), status: !off("status"), flags: !off("flags") };
}

export function readPreferences(): LayoutPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (raw === null) return DEFAULT_PREFERENCES;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_PREFERENCES;
    const { left, right } = value as Record<string, unknown>;
    return { left: readSide("left", left), right: readSide("right", right) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(value: LayoutPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Settings stay usable in memory when the browser denies storage.
  }
}

export function effectiveLayout(preference: LayoutPreferences[Side], phone: boolean): PanelLayout {
  return phone && preference.mobile !== "same" ? preference.mobile : preference.layout;
}
