// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_READING_PREFS, READING_PREFS_KEY, createReadingStore } from "../../shared/reading-prefs";
import { ReadingSettingsDialog, chosenRate, readingSettingsAreDefault, resetReadingSettings } from "./ReadingSettingsDialog";
import { readingSettingsHr as t } from "./messages.hr";
import { READ_ALOUD_RATE_KEY, loadReadAloudRate, readAloudRate, saveReadAloudRate } from "./rate-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const root = () => { const attrs = new Map<string, string>(); return { attrs, setAttribute: (k: string, v: string) => void attrs.set(k, v) }; };

let host: HTMLElement;
beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => { host.remove(); localStorage.clear(); });

const press = (label: string, group: string) => {
  const button = [...host.querySelectorAll(`[role="group"][aria-label="${group}"] button`)].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button ${label} in ${group}`);
  act(() => { (button as HTMLButtonElement).click(); });
};
const pressAction = (label: string) => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button ${label}`);
  act(() => { (button as HTMLButtonElement).click(); });
};
const mount = (store = createReadingStore(localStorage, document.documentElement)) => {
  act(() => { createRoot(host).render(createElement(ReadingSettingsDialog, { open: true, onClose: () => undefined, store })); });
  return store;
};

describe("reading settings dialog (WEB-V20-POSTAVKE-DIJALOG)", () => {
  it("shows the three parts: font, reading mode, read-aloud speed", () => {
    mount();
    expect(host.querySelector("dialog")?.getAttribute("aria-labelledby")).toBeTruthy();
    for (const name of [t.font.label, "Širina retka", t.rate.label]) expect(host.querySelector(`[role="group"][aria-label="${name}"]`)).not.toBeNull();
  });

  it("changing the font, the reading mode and the speed changes the stored settings and <html>", () => {
    const store = mount();
    press(t.font.dyslexia, t.font.label);
    press("Uža", "Širina retka");
    press(t.rate.fast, t.rate.label);
    expect(store.get()).toMatchObject({ font: "dyslexia", width: "narrow" });
    expect(document.documentElement.getAttribute("data-reading-font")).toBe("dyslexia");
    expect(document.documentElement.getAttribute("data-reading-width")).toBe("narrow");
    expect(JSON.parse(localStorage.getItem(READING_PREFS_KEY) ?? "{}")).toMatchObject({ font: "dyslexia", width: "narrow" });
    expect(readAloudRate()).toBe(1.25);
    expect(loadReadAloudRate(localStorage)).toBe(1.25);
    // The pressed button says so.
    expect([...host.querySelectorAll(`[role="group"][aria-label="${t.rate.label}"] button`)].find((b) => b.textContent === t.rate.fast)?.getAttribute("aria-pressed")).toBe("true");
  });

  it("\"Zadano\" puts every setting back, in storage and on <html>", () => {
    const store = mount();
    press(t.font.dyslexia, t.font.label);
    press("Veći", "Razmak redaka");
    press(t.rate.faster, t.rate.label);
    pressAction(t.reset);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(t.resetDone);
    expect(store.get()).toEqual(DEFAULT_READING_PREFS);
    expect(readAloudRate()).toBe(1);
    expect(localStorage.getItem(READ_ALOUD_RATE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-reading-font")).toBe("standard");
    expect([...host.querySelectorAll("button")].find((b) => b.textContent === t.reset)?.hasAttribute("disabled")).toBe(true);
  });

  it("the reading-mode reset inside the dialog leaves the font and the speed alone", () => {
    const store = mount();
    press(t.font.dyslexia, t.font.label);
    press("Šira", "Širina retka");
    pressAction("Vrati na zadano");
    expect(store.get()).toMatchObject({ font: "dyslexia", width: "standard" });
  });

  it("refuses a value outside the closed sets", () => {
    const store = createReadingStore(memory(), root());
    expect(chosenRate("0.1")).toBeNull();
    expect(chosenRate("nope")).toBeNull();
    expect(chosenRate("")).toBeNull();
    expect(chosenRate("1.25")).toBe(1.25);
    expect(saveReadAloudRate(9, memory())).toBe(false);
    expect(saveReadAloudRate(Number.NaN, memory())).toBe(false);
    expect(store.set("font", "comic" as never)).toEqual(DEFAULT_READING_PREFS);
  });

  it("ignores a bad stored speed and survives blocked storage", () => {
    for (const raw of ["\"fast\"", "2", "0", "{", "null"]) expect(loadReadAloudRate({ getItem: () => raw })).toBe(1);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadReadAloudRate(blocked)).toBe(1);
    expect(saveReadAloudRate(1.5, blocked)).toBe(false);
    expect(saveReadAloudRate(1.5, null)).toBe(false);
    const store = createReadingStore(blocked, root());
    expect(() => resetReadingSettings(store)).not.toThrow();
  });

  it("reports whether everything is at the default", () => {
    expect(readingSettingsAreDefault(DEFAULT_READING_PREFS, 1)).toBe(true);
    expect(readingSettingsAreDefault({ ...DEFAULT_READING_PREFS, font: "dyslexia" }, 1)).toBe(false);
    expect(readingSettingsAreDefault(DEFAULT_READING_PREFS, 1.25)).toBe(false);
  });

  it("is mounted in the toolbar's Više menu and sends nothing to the server", () => {
    const toolbar = readFileSync(resolve(process.cwd(), "src/host/editor/toolbar/ToolbarBehaviour.tsx"), "utf8");
    expect(toolbar).toContain("<ReadingSettingsDialog");
    expect(toolbar).toContain('id: "reading-settings"');
    const own = ["ReadingSettingsDialog.tsx", "rate-store.ts"].map((f) => readFileSync(resolve(process.cwd(), "src/host/editor/reading-settings", f), "utf8")).join("\n");
    expect(own).not.toMatch(/fetch\(|callMigrationRoute|\/api\/v1/);
  });
});
