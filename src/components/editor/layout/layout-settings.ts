/**
 * The editor shell's measures and the two widths the writer chooses (WEB-6A,
 * E§1, INVENTAR 1.5 and 1.6). Pure, so the shell and the tests read the same
 * numbers. The choices live only in the browser (localStorage); without
 * storage, or with a damaged value, the default is used and nothing throws.
 */

export const HEADER_HEIGHT = 48;
export const TOOLS_HEIGHT = 44;
export const SHEET_MAX_WIDTH = 820;

/** Breakpoints in px, as in the prototype: the rail drawer, the panel drawer, one-column grids, phone. */
export const BREAKPOINTS = { rail: 1250, panel: 1050, grid: 760, phone: 640 } as const;

export const RAIL_WIDTHS = { narrow: 248, medium: 288, wide: 340 } as const;
export const PANEL_WIDTHS = { narrow: 300, medium: 340, wide: 400 } as const;

export type RailSize = keyof typeof RAIL_WIDTHS;
export type PanelSize = keyof typeof PANEL_WIDTHS;
export type LayoutSettings = { readonly rail: RailSize; readonly panel: PanelSize };

export const DEFAULT_SETTINGS: LayoutSettings = { rail: "medium", panel: "medium" };
export const STORAGE_KEY = "ductura.editor.layout";

const isKey = (table: Readonly<Record<string, number>>, v: unknown): boolean =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(table, v);

/** Reads stored text; anything but a known size falls back to the default for that side. */
export function parseSettings(raw: string | null): LayoutSettings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return DEFAULT_SETTINGS;
    const o = v as Record<string, unknown>;
    return {
      rail: isKey(RAIL_WIDTHS, o.rail) ? (o.rail as RailSize) : DEFAULT_SETTINGS.rail,
      panel: isKey(PANEL_WIDTHS, o.panel) ? (o.panel as PanelSize) : DEFAULT_SETTINGS.panel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): LayoutSettings {
  try {
    return parseSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Returns whether the choice was kept; the page works the same when it was not. */
export function saveSettings(
  settings: LayoutSettings,
  storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    return storage !== undefined;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
