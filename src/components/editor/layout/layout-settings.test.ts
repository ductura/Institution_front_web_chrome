import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BREAKPOINTS, DEFAULT_SETTINGS, PANEL_WIDTHS, RAIL_WIDTHS, STORAGE_KEY, loadSettings, onSettingsChange, parseSettings, saveSettings,
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

// ED-39: the shell menu and the dialog "Prilagodi panel" choose the same widths; a choice is told to the other.
describe("layout settings on the page (ED-39)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells every listener of a choice, read as the stored value would be, until it unsubscribes", () => {
    vi.stubGlobal("window", new EventTarget());
    const seen: unknown[] = [];
    const stop = onSettingsChange((settings) => seen.push(settings));
    const storage = { setItem: () => undefined };
    saveSettings({ rail: "wide", panel: "narrow" }, storage);
    window.dispatchEvent(new CustomEvent("ductura:editor-layout", { detail: { rail: "huge" } }));
    stop();
    saveSettings({ rail: "narrow", panel: "wide" }, storage);
    expect(seen).toEqual([{ rail: "wide", panel: "narrow" }, DEFAULT_SETTINGS]);
  });

  it("keeps the choice without a page to tell", () => {
    expect(saveSettings({ rail: "wide", panel: "wide" }, { setItem: () => undefined })).toBe(true);
    expect(onSettingsChange(() => undefined)).toBeTypeOf("function");
  });
});
