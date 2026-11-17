import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PANEL_DEFAULTS, parseSettings, readSettings, settingsKey, writeSettings, type PanelSettings } from "./panel-settings";

const KEY = settingsKey("izmisljeni-dokument")!;
const memory = () => {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
};
const valid: fc.Arbitrary<PanelSettings> = fc.record({
  layout: fc.constant("popis" as const),
  levels: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
  collapsed: fc.uniqueArray(fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/), { maxLength: 200 }),
  headingsOnly: fc.boolean(),
});
const isValid = (s: PanelSettings) => s.layout === "popis" && [1, 2, 3].includes(s.levels) && typeof s.headingsOnly === "boolean"
  && Array.isArray(s.collapsed) && new Set(s.collapsed).size === s.collapsed.length && s.collapsed.length <= 200;

describe("panel settings properties (DAN-979, 979-1)", () => {
  it("reads back every valid setting exactly as written", () => {
    fc.assert(fc.property(valid, (s) => {
      const store = memory();
      expect(writeSettings(store, KEY, s)).toBe(true);
      expect(readSettings(store, KEY)).toEqual(s);
    }));
  });

  it("writes every accepted setting, however its ids are spelled", () => {
    fc.assert(fc.property(fc.uniqueArray(fc.string({ minLength: 1, maxLength: 64, unit: "binary" }), { maxLength: 200 }), (ids) => {
      const s = parseSettings({ collapsed: ids });
      expect(writeSettings(memory(), KEY, s)).toBe(true);
    }));
  });

  it("reads back any input in its normal form, sparse arrays included", () => {
    const sparse = fc.record({ collapsed: fc.sparseArray(fc.stringMatching(/^[a-z]{1,3}$/), { maxLength: 5 }) });
    fc.assert(fc.property(fc.oneof(fc.anything(), sparse), (x) => {
      const store = memory();
      writeSettings(store, KEY, x as never);
      expect(readSettings(store, KEY)).toEqual(parseSettings(x));
    }));
  });

  it("gives valid settings for any stored string and never throws", () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.json()), (value) => {
      const s = readSettings({ getItem: () => value, setItem: () => {} }, KEY);
      expect(isValid(s)).toBe(true);
    }));
    expect(isValid(PANEL_DEFAULTS)).toBe(true);
  });
});
