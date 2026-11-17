/**
 * Panel settings kept in the browser (DAN-979, 979-1): the layout, the levels
 * shown, the collapsed branches and "Samo naslovi". Only display choices and
 * block ids are stored, never the text of a work. Every read and write of the
 * store sits in try/catch: without a store, or with one that throws (private
 * windows, a full quota), the panel works with the defaults.
 */
import { OUTLINE_LEVELS } from "./outline-tree";

/** The panel's layouts; one so far, so another one does not change the record. */
export const PANEL_LAYOUTS = ["popis"] as const;

export type PanelSettings = {
  readonly layout: (typeof PANEL_LAYOUTS)[number];
  readonly levels: 1 | 2 | 3;
  /** Collapsed branches by block id (`entry.id`), which stays when a heading is added above. */
  readonly collapsed: readonly string[];
  readonly headingsOnly: boolean;
};

export const PANEL_DEFAULTS: PanelSettings = Object.freeze({
  layout: "popis", levels: OUTLINE_LEVELS as 3, collapsed: Object.freeze([]), headingsOnly: false,
});

export const COLLAPSED_MAX = 200;
export const ID_MAX = 64;
/** Longest record read or written, in UTF-16 units as browsers count the quota; the largest valid settings fit. */
export const MAX_RAW = 16_384;
/** Versioned, so a later key for collapsed branches is a new record, not a broken one. */
export const PANEL_SETTINGS_PREFIX = "ductura.outline.v1:";
const SCOPE_MAX = 200;

export type SettingsStore = Pick<Storage, "getItem" | "setItem"> | null | undefined;

const own = (o: object, key: string): unknown => (Object.hasOwn(o, key) ? (o as Record<string, unknown>)[key] : undefined);

function validCollapsed(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > COLLAPSED_MAX) return null;
  if (!value.every((id) => typeof id === "string" && id.length >= 1 && id.length <= ID_MAX)) return null;
  return new Set(value).size === value.length ? [...value] : null;
}

/** Valid settings from anything; each invalid or missing field takes its default. Never throws. */
export function parseSettings(raw: unknown): PanelSettings {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return PANEL_DEFAULTS;
    const layout = own(raw, "layout");
    const levels = own(raw, "levels");
    const headingsOnly = own(raw, "headingsOnly");
    return {
      layout: PANEL_LAYOUTS.find((l) => l === layout) ?? PANEL_DEFAULTS.layout,
      levels: Number.isInteger(levels) && (levels as number) >= 1 && (levels as number) <= OUTLINE_LEVELS
        ? (levels as 1 | 2 | 3) : PANEL_DEFAULTS.levels,
      collapsed: validCollapsed(own(raw, "collapsed")) ?? PANEL_DEFAULTS.collapsed,
      headingsOnly: typeof headingsOnly === "boolean" ? headingsOnly : PANEL_DEFAULTS.headingsOnly,
    };
  } catch {
    // A getter or a proxy that throws: nothing in it can be trusted.
    return PANEL_DEFAULTS;
  }
}

/** The store key for a scope the caller gives (the editor: a digest of the document id), or null. */
export function settingsKey(scope: string): string | null {
  return scope.trim() === "" || scope.length > SCOPE_MAX ? null : `${PANEL_SETTINGS_PREFIX}${scope}`;
}

/** The stored settings, or the defaults when there is no store, it throws, or the record is broken or too long. */
export function readSettings(store: SettingsStore, key: string): PanelSettings {
  let text: string | null;
  try {
    text = store ? store.getItem(key) : null;
  } catch {
    return PANEL_DEFAULTS;
  }
  if (typeof text !== "string" || text.length > MAX_RAW) return PANEL_DEFAULTS;
  try {
    return parseSettings(JSON.parse(text));
  } catch {
    return PANEL_DEFAULTS;
  }
}

/** Writes the settings in their normal form; false when there is no store, it throws, or the record is too long. */
export function writeSettings(store: SettingsStore, key: string, settings: PanelSettings): boolean {
  try {
    const text = JSON.stringify(parseSettings(settings));
    if (!store || text.length > MAX_RAW) return false;
    store.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** Removes every panel settings key, for logout; never throws. */
export function clearPanelSettings(store: Pick<Storage, "length" | "key" | "removeItem"> | null | undefined): void {
  try {
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(PANEL_SETTINGS_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      try {
        store.removeItem(key);
      } catch {
        // Keep removing the others.
      }
    }
  } catch {
    // The store cannot be listed: nothing more to do.
  }
}
