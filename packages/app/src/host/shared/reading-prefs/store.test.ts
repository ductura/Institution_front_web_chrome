import { describe, expect, it } from "vitest";

import { DEFAULT_READING_PREFS, READING_PREFS_KEY, type ReadingPrefs } from "./model";
import { applyReadingPrefs, createReadingStore, loadReadingPrefs, saveReadingPrefs } from "./store";

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
};
const fakeRoot = () => {
  const attrs: Record<string, string> = {};
  return { attrs, setAttribute: (k: string, v: string) => void (attrs[k] = v) };
};
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("reading prefs store (WEB-V20-PREF-CITANJE)", () => {
  it("starts from defaults and writes all attributes on <html>", () => {
    const root = fakeRoot();
    createReadingStore(memory(), root);
    expect(root.attrs).toEqual({
      "data-reading-font": "standard",
      "data-reading-width": "standard",
      "data-reading-line-height": "standard",
      "data-reading-letter-spacing": "standard",
      "data-reading-paragraph-gap": "standard",
    });
  });

  it("applies a stored choice at start and keeps it after a new store (a reload)", () => {
    const storage = memory();
    const first = createReadingStore(storage, fakeRoot());
    first.set("font", "dyslexia");
    first.set("width", "narrow");
    const root = fakeRoot();
    const second = createReadingStore(storage, root);
    expect(second.get()).toEqual({ ...DEFAULT_READING_PREFS, font: "dyslexia", width: "narrow" });
    expect(root.attrs["data-reading-font"]).toBe("dyslexia");
    expect(JSON.parse(storage.data[READING_PREFS_KEY]!).width).toBe("narrow");
  });

  it("refuses a value outside the closed set and changes nothing", () => {
    const storage = memory();
    const root = fakeRoot();
    const store = createReadingStore(storage, root);
    store.set("font", "dyslexia");
    store.set("font", "comic" as unknown as ReadingPrefs["font"]);
    expect(store.get().font).toBe("dyslexia");
    expect(root.attrs["data-reading-font"]).toBe("dyslexia");
  });

  it("ignores a corrupt stored value", () => {
    expect(loadReadingPrefs(memory({ [READING_PREFS_KEY]: "{not json" }))).toEqual(DEFAULT_READING_PREFS);
  });

  it("blocked storage does not break the screen; the choice holds for this visit", () => {
    const root = fakeRoot();
    const store = createReadingStore(blocked, root);
    expect(store.get()).toEqual(DEFAULT_READING_PREFS);
    expect(() => store.set("letterSpacing", "wide")).not.toThrow();
    expect(store.get().letterSpacing).toBe("wide");
    expect(root.attrs["data-reading-letter-spacing"]).toBe("wide");
    expect(saveReadingPrefs(store.get(), blocked)).toBe(false);
    expect(() => createReadingStore(null, null)).not.toThrow();
  });

  it("reset returns the defaults and notifies listeners until unsubscribed", () => {
    const store = createReadingStore(memory(), fakeRoot());
    const seen: ReadingPrefs[] = [];
    const off = store.subscribe((p) => seen.push(p));
    store.set("lineHeight", "loose");
    store.reset();
    off();
    store.set("lineHeight", "relaxed");
    expect(seen.map((p) => p.lineHeight)).toEqual(["loose", "standard"]);
    expect(store.get().lineHeight).toBe("relaxed");
  });

  it("applyReadingPrefs sanitizes what it is given", () => {
    const root = fakeRoot();
    applyReadingPrefs({ font: "x" } as unknown as ReadingPrefs, root);
    expect(root.attrs["data-reading-font"]).toBe("standard");
  });
});
