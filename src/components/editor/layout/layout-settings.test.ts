import { describe, expect, it } from "vitest";

import {
  BREAKPOINTS, DEFAULT_SETTINGS, PANEL_WIDTHS, RAIL_WIDTHS, STORAGE_KEY, loadSettings, parseSettings, saveSettings,
} from "./layout-settings";

describe("layout settings (E§1)", () => {
  it("keeps the prototype's measures", () => {
    expect(RAIL_WIDTHS).toEqual({ narrow: 248, medium: 288, wide: 340 });
    expect(PANEL_WIDTHS).toEqual({ narrow: 300, medium: 340, wide: 400 });
    expect(BREAKPOINTS).toEqual({ rail: 1250, panel: 1050, grid: 760, phone: 640 });
  });
  it("falls back to the default for missing or damaged values", () => {
    for (const raw of [null, "", "{", "7", '{"rail":"huge","panel":3}']) expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
  it("reads each side on its own", () => {
    expect(parseSettings('{"rail":"wide","panel":"x"}')).toEqual({ rail: "wide", panel: "medium" });
  });
  it("round-trips through storage and survives storage that throws", () => {
    const mem = new Map<string, string>();
    const ok = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(saveSettings({ rail: "narrow", panel: "wide" }, ok)).toBe(true);
    expect(mem.has(STORAGE_KEY)).toBe(true);
    expect(loadSettings(ok)).toEqual({ rail: "narrow", panel: "wide" });
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS, bad)).toBe(false);
  });
});
