/**
 * Interface languages of the UI package (D-70, M11.5): Croatian is the
 * default, English the second. The language of a work is a separate value of
 * the work (F-06) and is never read from this one.
 */
export const UI_LOCALES = ["hr", "en"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = "hr";

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}

/** The value of `<html lang>` for a language. */
export function htmlLang(locale: UiLocale): string {
  return locale;
}
