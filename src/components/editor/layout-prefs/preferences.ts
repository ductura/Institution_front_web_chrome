export const LAYOUTS = ["a", "b", "c"] as const;
export type PanelLayout = (typeof LAYOUTS)[number];
export type MobileLayout = PanelLayout | "same";
export type Side = "left" | "right";
export type LayoutPreferences = Record<Side, { layout: PanelLayout; mobile: MobileLayout }>;

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
  const { layout, mobile } = value as Record<string, unknown>;
  return {
    layout: isPanelLayout(layout) ? layout : defaults.layout,
    mobile: mobile === "same" || isPanelLayout(mobile) ? mobile : defaults.mobile,
  };
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
