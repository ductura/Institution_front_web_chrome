// WEB-V20-PREF-CITANJE: personal reading preferences (font, line width, spacing). Browser only, no API, no server fields.
// Every field is a closed set of steps; anything else is ignored and the field keeps its default.

export const READING_PREFS_KEY = "ductura.reading.v1";

export const READING_FONTS = ["standard", "dyslexia"] as const;
export const READING_WIDTHS = ["narrow", "standard", "wide"] as const;
export const READING_LINE_HEIGHTS = ["standard", "relaxed", "loose"] as const;
export const READING_LETTER_SPACINGS = ["standard", "wide", "wider"] as const;
export const READING_PARAGRAPH_GAPS = ["standard", "wide", "wider"] as const;

export type ReadingFont = (typeof READING_FONTS)[number];
export type ReadingWidth = (typeof READING_WIDTHS)[number];
export type ReadingLineHeight = (typeof READING_LINE_HEIGHTS)[number];
export type ReadingLetterSpacing = (typeof READING_LETTER_SPACINGS)[number];
export type ReadingParagraphGap = (typeof READING_PARAGRAPH_GAPS)[number];

export interface ReadingPrefs {
  font: ReadingFont;
  width: ReadingWidth;
  lineHeight: ReadingLineHeight;
  letterSpacing: ReadingLetterSpacing;
  paragraphGap: ReadingParagraphGap;
}

export type ReadingPrefKey = keyof ReadingPrefs;

export const DEFAULT_READING_PREFS: Readonly<ReadingPrefs> = Object.freeze({
  font: "standard",
  width: "standard",
  lineHeight: "standard",
  letterSpacing: "standard",
  paragraphGap: "standard",
});

export const READING_STEPS: { readonly [K in ReadingPrefKey]: readonly ReadingPrefs[K][] } = {
  font: READING_FONTS,
  width: READING_WIDTHS,
  lineHeight: READING_LINE_HEIGHTS,
  letterSpacing: READING_LETTER_SPACINGS,
  paragraphGap: READING_PARAGRAPH_GAPS,
};

export const READING_KEYS = Object.keys(READING_STEPS) as ReadingPrefKey[];

/** The attribute on <html> for each field: data-reading-font, data-reading-width, ... */
export const readingAttribute = (key: ReadingPrefKey): string => `data-reading-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

export function isStep<K extends ReadingPrefKey>(key: K, value: unknown): value is ReadingPrefs[K] {
  return typeof value === "string" && (READING_STEPS[key] as readonly string[]).includes(value);
}

/** Unknown input never throws: bad fields (or a non-object) fall back to the default of that field. */
export function sanitizeReadingPrefs(input: unknown): ReadingPrefs {
  const out: ReadingPrefs = { ...DEFAULT_READING_PREFS };
  if (typeof input !== "object" || input === null || Array.isArray(input)) return out;
  const record = input as Record<string, unknown>;
  for (const key of READING_KEYS) {
    const value = Object.hasOwn(record, key) ? record[key] : undefined;
    if (isStep(key, value)) (out as Record<ReadingPrefKey, string>)[key] = value;
  }
  return out;
}

export function parseReadingPrefs(raw: string | null | undefined): ReadingPrefs {
  if (typeof raw !== "string") return { ...DEFAULT_READING_PREFS };
  try {
    return sanitizeReadingPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READING_PREFS };
  }
}

export const serializeReadingPrefs = (prefs: ReadingPrefs): string => JSON.stringify(sanitizeReadingPrefs(prefs));

/** True when every field is at its default (nothing is changed on screen). */
export const isDefaultReadingPrefs = (prefs: ReadingPrefs): boolean => READING_KEYS.every((k) => prefs[k] === DEFAULT_READING_PREFS[k]);

/** The attributes to put on <html>, one per field. */
export function readingAttributes(prefs: ReadingPrefs): Record<string, string> {
  const clean = sanitizeReadingPrefs(prefs);
  return Object.fromEntries(READING_KEYS.map((k) => [readingAttribute(k), clean[k]]));
}
