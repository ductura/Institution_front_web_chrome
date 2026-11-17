import { describe, expect, it } from "vitest";

import {
  clearPanelSettings, MAX_RAW, PANEL_DEFAULTS, PANEL_SETTINGS_PREFIX, parseSettings, readSettings, settingsKey, writeSettings,
  type PanelSettings,
} from "./panel-settings";

// A Storage in memory with the parts the settings use (as memoryStorage in src/platform).
function memory(seed: Record<string, string> = {}) {
  const items = new Map(Object.entries(seed));
  return {
    get length() { return items.size; },
    key: (i: number) => [...items.keys()][i] ?? null,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
    items,
  };
}
const raw = (value: string) => ({ getItem: () => value, setItem: () => {} });
const throwing = (name: string) => () => { throw new DOMException("izmišljeno", name); };
const KEY = settingsKey("izmisljeni-dokument")!;
const full: PanelSettings = {
  layout: "popis", levels: 3, headingsOnly: true,
  collapsed: Array.from({ length: 200 }, (_, i) => `${"b".repeat(60)}${String(i).padStart(4, "0")}`),
};

describe("panel settings: no store, a throwing store or a broken record give defaults (DAN-979, 979-1)", () => {
  it("reads defaults without a store and refuses to write", () => {
    for (const store of [undefined, null]) {
      expect(readSettings(store, KEY)).toEqual(PANEL_DEFAULTS);
      expect(writeSettings(store, KEY, full)).toBe(false);
    }
  });

  it("never throws when the store throws SecurityError or QuotaExceededError", () => {
    const store = { getItem: throwing("SecurityError"), setItem: throwing("QuotaExceededError") };
    expect(readSettings(store, KEY)).toEqual(PANEL_DEFAULTS);
    expect(writeSettings(store, KEY, full)).toBe(false);
  });

  it("reads defaults for broken, foreign or oversized records", () => {
    for (const value of ["{", "null", "[]", "42", '"popis"', "x".repeat(70_000), `{"levels":2,"pad":"${"x".repeat(MAX_RAW)}"}`]) {
      expect(readSettings(raw(value), KEY)).toEqual(PANEL_DEFAULTS);
    }
  });

  it("ignores prototype keys and keeps the valid fields", () => {
    expect(readSettings(raw('{"__proto__":{"levels":1},"levels":2}'), KEY)).toEqual({ ...PANEL_DEFAULTS, levels: 2 });
    expect(readSettings(raw('{"collapsed":["__proto__"],"constructor":1,"toString":2}'), KEY))
      .toEqual({ ...PANEL_DEFAULTS, collapsed: ["__proto__"] });
  });

  it("gives each invalid field its default, field by field", () => {
    for (const levels of [0, 4, 1.5, "2", null]) expect(parseSettings({ levels, headingsOnly: true })).toEqual({ ...PANEL_DEFAULTS, headingsOnly: true });
    for (const collapsed of [Array.from({ length: 201 }, (_, i) => `b${i}`), [""], ["x".repeat(65)], [1], ["a", "a"], "a"]) {
      expect(parseSettings({ collapsed, levels: 1 })).toEqual({ ...PANEL_DEFAULTS, levels: 1 });
    }
    expect(parseSettings({ layout: "kartice", headingsOnly: "true" })).toEqual(PANEL_DEFAULTS);
  });

  it("survives a getter or a proxy that throws", () => {
    const getter = Object.defineProperty({}, "levels", { enumerable: true, get: () => { throw new Error("izmišljeno"); } });
    const proxy = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error("izmišljeno"); } });
    expect(parseSettings(getter)).toEqual(PANEL_DEFAULTS);
    expect(parseSettings(proxy)).toEqual(PANEL_DEFAULTS);
  });

  it("builds a key only from a usable scope", () => {
    for (const scope of ["", "   ", "x".repeat(201)]) expect(settingsKey(scope)).toBeNull();
    expect(settingsKey("izmisljeni-dokument")).toBe(`${PANEL_SETTINGS_PREFIX}izmisljeni-dokument`);
  });
});

describe("written settings read back equal (979-1 acceptance)", () => {
  it("round-trips the largest valid settings through an in-memory localStorage", () => {
    const store = memory();
    expect(writeSettings(store, KEY, full)).toBe(true);
    expect(store.items.get(KEY)!.length).toBeLessThanOrEqual(MAX_RAW);
    expect(readSettings(store, KEY)).toEqual(full);
  });

  it("writes invalid settings in their normal form", () => {
    const store = memory();
    expect(writeSettings(store, KEY, { levels: 9, collapsed: ["a"] } as never)).toBe(true);
    expect(readSettings(store, KEY)).toEqual({ ...PANEL_DEFAULTS, collapsed: ["a"] });
  });

  it("clears only its own keys, and never throws", () => {
    const store = memory({ [KEY]: "{}", [`${PANEL_SETTINGS_PREFIX}drugi`]: "{}", "ductura.theme": "light" });
    clearPanelSettings(store);
    expect([...store.items.keys()]).toEqual(["ductura.theme"]);
    expect(() => clearPanelSettings({ length: 1, key: throwing("SecurityError"), removeItem: throwing("SecurityError") })).not.toThrow();
    expect(() => clearPanelSettings(null)).not.toThrow();
  });
});
