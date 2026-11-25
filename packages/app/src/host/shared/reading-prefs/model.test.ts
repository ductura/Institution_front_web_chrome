import { describe, expect, it } from "vitest";

import {
  DEFAULT_READING_PREFS,
  READING_KEYS,
  READING_PREFS_KEY,
  READING_STEPS,
  isDefaultReadingPrefs,
  parseReadingPrefs,
  readingAttribute,
  readingAttributes,
  sanitizeReadingPrefs,
  serializeReadingPrefs,
} from "./model";

describe("reading prefs model (WEB-V20-PREF-CITANJE)", () => {
  it("uses the agreed key and defaults that change nothing", () => {
    expect(READING_PREFS_KEY).toBe("ductura.reading.v1");
    expect(isDefaultReadingPrefs(DEFAULT_READING_PREFS)).toBe(true);
    expect(DEFAULT_READING_PREFS.font).toBe("standard");
  });

  it("names the html attributes data-reading-*", () => {
    expect(READING_KEYS.map(readingAttribute)).toEqual([
      "data-reading-font",
      "data-reading-width",
      "data-reading-line-height",
      "data-reading-letter-spacing",
      "data-reading-paragraph-gap",
    ]);
  });

  it("every step of every field round-trips and gives its attribute", () => {
    for (const key of READING_KEYS) {
      for (const value of READING_STEPS[key]) {
        const prefs = sanitizeReadingPrefs({ ...DEFAULT_READING_PREFS, [key]: value });
        expect(prefs[key]).toBe(value);
        expect(parseReadingPrefs(serializeReadingPrefs(prefs))[key]).toBe(value);
        expect(readingAttributes(prefs)[readingAttribute(key)]).toBe(value);
      }
    }
  });

  it("ignores a bad stored value per field and keeps the good ones", () => {
    const parsed = parseReadingPrefs(JSON.stringify({ font: "dyslexia", width: "huge", lineHeight: 3, letterSpacing: null, paragraphGap: "wide" }));
    expect(parsed).toEqual({ ...DEFAULT_READING_PREFS, font: "dyslexia", paragraphGap: "wide" });
  });

  it("falls back to defaults for broken, empty or non-object storage", () => {
    for (const raw of [null, undefined, "", "{", "null", "[]", "42", '"dyslexia"']) {
      expect(parseReadingPrefs(raw)).toEqual(DEFAULT_READING_PREFS);
    }
  });

  it("does not read inherited keys (no prototype tricks)", () => {
    expect(parseReadingPrefs('{"__proto__":{"font":"dyslexia"}}').font).toBe("standard");
  });
});
