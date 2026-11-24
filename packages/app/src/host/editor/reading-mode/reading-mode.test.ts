import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_READING_PREFS, READING_STEPS, createReadingStore, readingAttribute } from "../../shared/reading-prefs";
import { ReadingModeControls } from "./ReadingModeControls";
import { READING_MODE_FIELDS, chosenStep, readingModeGroups, readingModeIsDefault } from "./reading-mode-model";
import { readingModeHr } from "./messages.hr";

const css = readFileSync(new URL("./reading-mode.module.css", import.meta.url), "utf8");
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const root = () => {
  const attrs = new Map<string, string>();
  return { attrs, setAttribute: (k: string, v: string) => void attrs.set(k, v) };
};

describe("reading mode (WEB-V20-NACIN-CITANJA)", () => {
  it("offers every step of the model for the four sheet fields, with a Croatian label", () => {
    const groups = readingModeGroups();
    expect(groups.map((g) => g.field)).toEqual([...READING_MODE_FIELDS]);
    for (const g of groups) {
      expect(g.options.map((o) => o.value)).toEqual([...READING_STEPS[g.field]]);
      for (const o of g.options) expect(o.label).not.toBe(o.value);
      expect(g.label).toBe(readingModeHr[g.field].label);
    }
  });

  it("gives every non-default value an attribute on <html> and a style rule; the default has no rule", () => {
    for (const field of READING_MODE_FIELDS) {
      for (const value of READING_STEPS[field]) {
        const r = root();
        const s = createReadingStore(memory(), r);
        s.set(field, value as never);
        expect(r.attrs.get(readingAttribute(field))).toBe(value);
        const selector = `html[${readingAttribute(field)}="${value}"]`;
        expect(css.includes(selector)).toBe(value !== DEFAULT_READING_PREFS[field]);
      }
    }
  });

  it("changes nothing on the default: no rule is keyed to a default step", () => {
    expect(css).not.toMatch(/="standard"/);
  });

  it("refuses a value outside the closed set of a field", () => {
    expect(chosenStep("width", "wide")).toBe("wide");
    expect(chosenStep("width", "huge")).toBeNull();
    expect(chosenStep("lineHeight", "wide")).toBeNull();
    expect(chosenStep("width", "")).toBeNull();
  });

  it("scopes the rules to the sheet's text, never the shell, and uses no external URL", () => {
    for (const line of css.split("\n").filter((l) => l.startsWith(":global("))) expect(line).toContain(".editor-surface");
    // .sheet is also the frame of the sign-in and teacher screens: the wide rule must be tied to the editor's sheet.
    expect(css).toContain('html[data-reading-width="wide"] .sheet:has(.editor-surface)');
    expect(css).not.toMatch(/\.sheet\) \{/);
    expect(css).not.toMatch(/url\(|@import|https?:/);
  });

  it("knows when the four fields are at their default, whatever the font", () => {
    expect(readingModeIsDefault({ ...DEFAULT_READING_PREFS })).toBe(true);
    expect(readingModeIsDefault({ ...DEFAULT_READING_PREFS, font: "dyslexia" })).toBe(true);
    expect(readingModeIsDefault({ ...DEFAULT_READING_PREFS, paragraphGap: "wide" })).toBe(false);
  });

  it("draws one pressed step per field and disables the reset while all is default", () => {
    const html = renderToStaticMarkup(createElement(ReadingModeControls, { prefs: { ...DEFAULT_READING_PREFS }, onChange: vi.fn(), onReset: vi.fn() }));
    expect(html).toContain(readingModeHr.title);
    for (const f of READING_MODE_FIELDS) expect(html).toContain(`>${readingModeHr[f].label}</p>`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(READING_MODE_FIELDS.length);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Vrati na zadano/);
    const changed = renderToStaticMarkup(createElement(ReadingModeControls, { prefs: { ...DEFAULT_READING_PREFS, width: "narrow" }, onChange: vi.fn(), onReset: vi.fn() }));
    expect(changed).not.toMatch(/<button[^>]*disabled=""[^>]*>Vrati na zadano/);
  });

  it("lifts the sheet's cap for the wide step and covers the closing list and quote paragraphs", () => {
    expect(css).toMatch(/html\[data-reading-width="wide"\] \.sheet:has\(\.editor-surface\)\) \{ max-width: (\d+)px/);
    expect(Number(/data-reading-width="wide"\] \.sheet:has\(\.editor-surface\)\) \{ max-width: (\d+)px/.exec(css)?.[1])).toBeGreaterThan(720);
    for (const gap of ["wide", "wider"]) {
      // The general rule leaves the inner items of a list and of a quote alone (they stay one run).
      expect(css).toContain(`html[data-reading-paragraph-gap="${gap}"] .editor-surface .ProseMirror p:not([data-block="bullet-item"], [data-block="quote"]))`);
      expect(css).toContain(`html[data-reading-paragraph-gap="${gap}"] .editor-surface .ProseMirror p[data-block="bullet-item"]:not(:has(+ p[data-block="bullet-item"]))`);
      expect(css).toContain(`html[data-reading-paragraph-gap="${gap}"] .editor-surface .ProseMirror p[data-block="quote"]:not(:has(+ p[data-block="quote"]))`);
    }
  });

  it("reset returns the stored preferences and the attributes to the default", () => {
    const r = root();
    const store = createReadingStore(memory(), r);
    store.set("width", "narrow");
    store.set("lineHeight", "loose");
    store.reset();
    expect(store.get()).toEqual(DEFAULT_READING_PREFS);
    expect(r.attrs.get("data-reading-width")).toBe("standard");
  });
});
