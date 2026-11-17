/**
 * Panel settings kept in the browser (DAN-979, 979-1): the layout, the levels
 * shown, the collapsed branches and "Samo naslovi". Only display choices and
 * block ids are stored, never the text of a work. Every read and write of the
 * store sits in try/catch: without a store, or with one that throws (private
 * windows, a full quota), the panel works with the defaults.
 */
import { OUTLINE_LEVELS, type OutlineNode, type OutlineRow } from "./outline-tree";
import { collapsedSet } from "./outline-view";

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
/**
 * A stored id: letters, digits, - and _ (a Ductus block id is a UUID). JSON
 * escapes none of them, so the record's length is bounded by the id lengths.
 */
const ID_PATTERN = new RegExp(`^[A-Za-z0-9_-]{1,${ID_MAX}}$`);
/**
 * Longest record read or written, in UTF-16 units as browsers count the quota.
 * The largest valid settings fit: 200 ids of 64 unescaped characters is about 13 500.
 */
export const MAX_RAW = 16_384;
/** Versioned, so a later key for collapsed branches is a new record, not a broken one. */
export const PANEL_SETTINGS_PREFIX = "ductura.outline.v1:";
const SCOPE_MAX = 200;

export type SettingsStore = Pick<Storage, "getItem" | "setItem"> | null | undefined;

const own = (o: object, key: string): unknown => (Object.hasOwn(o, key) ? (o as Record<string, unknown>)[key] : undefined);

function validCollapsed(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > COLLAPSED_MAX) return null;
  // An index loop, not every(): every() skips the holes of a sparse array, which would let undefined through.
  const ids: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const id: unknown = value[i];
    if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;
    ids.push(id);
  }
  return new Set(ids).size === ids.length ? ids : null;
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

/**
 * The stored settings, or null when there is no store, it throws, or there is
 * no record or a broken, non-object or too long one (979-2): only a real
 * settings object overrides the panel's props. Its fields are normalised one by one.
 */
export function readStoredSettings(store: SettingsStore, key: string): PanelSettings | null {
  let text: string | null;
  try {
    text = store ? store.getItem(key) : null;
  } catch {
    return null;
  }
  if (typeof text !== "string" || text.length > MAX_RAW) return null;
  try {
    const value: unknown = JSON.parse(text);
    // Valid JSON that is not a settings object (null, an array, a number) is a broken record, not defaults.
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return parseSettings(value);
  } catch {
    return null;
  }
}

/** The stored settings, or the defaults when there is no store, it throws, or the record is broken or too long. */
export function readSettings(store: SettingsStore, key: string): PanelSettings {
  return readStoredSettings(store, key) ?? PANEL_DEFAULTS;
}

/** Ids that occur exactly once in the rows: the only ones a collapsed branch can be stored by. */
export function uniqueIds(rows: readonly OutlineRow[]): ReadonlyMap<string, number> {
  const seen = new Map<string, number>();
  const twice = new Set<string>();
  rows.forEach(({ entry }, index) => {
    if (entry.id === null) return;
    if (seen.has(entry.id)) twice.add(entry.id);
    else seen.set(entry.id, index);
  });
  for (const id of twice) seen.delete(id);
  return seen;
}

/**
 * The record to write (979-2): both current states, the collapsed branches by
 * unique id only (at most COLLAPSED_MAX, the first ones), layout and levels
 * kept from `base`.
 */
export function settingsFor(
  tree: readonly OutlineNode[], rows: readonly OutlineRow[], shut: readonly number[], headingsOnly: boolean, base: PanelSettings,
): PanelSettings {
  const unique = uniqueIds(rows);
  const collapsed = [...collapsedSet(tree, shut)].sort((a, b) => a - b)
    .map((index) => rows[index]!.entry.id)
    .filter((id): id is string => id !== null && unique.get(id) !== undefined && ID_PATTERN.test(id))
    .slice(0, COLLAPSED_MAX);
  return { ...base, collapsed, headingsOnly };
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
