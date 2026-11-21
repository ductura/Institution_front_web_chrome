import type { UiLocale } from "./locale";

/**
 * Dates and numbers by interface language (D-70, M11.5 criterion 3).
 *
 * The words and separators come from the tables below, not from the
 * runtime's locale data, so a date reads the same in every browser and on
 * the server ("21. studenoga 2026." in Croatian, "21 November 2026" in
 * English). Intl is used only for the numeric wall clock in Europe/Zagreb:
 * the student and the teacher of the pilot read the same clock on a deadline,
 * whatever the zone of the device (DAN-700).
 */
const MONTHS: Readonly<Record<UiLocale, readonly string[]>> = {
  hr: ["siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja", "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const SEPARATORS: Readonly<Record<UiLocale, { readonly group: string; readonly decimal: string }>> = {
  hr: { group: ".", decimal: "," },
  en: { group: ",", decimal: "." },
};

export const ZAGREB = "Europe/Zagreb";

export type Wall = { readonly year: number; readonly month: number; readonly day: number; readonly hour: number; readonly minute: number };

const wallFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ZAGREB, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
});

/** The Zagreb wall clock of an instant, or null for an invalid one. */
export function zagrebWall(instant: Date | string | number): Wall | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(wallFormat.formatToParts(date).find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") % 24, minute: part("minute") };
}

const two = (n: number) => String(n).padStart(2, "0");

function dateOf(wall: Wall, locale: UiLocale): string {
  const month = MONTHS[locale][wall.month - 1] ?? "";
  return locale === "hr" ? `${wall.day}. ${month} ${wall.year}.` : `${wall.day} ${month} ${wall.year}`;
}

/** "21. studenoga 2026." or "21 November 2026"; an empty string for an invalid instant. */
export function formatDate(instant: Date | string | number, locale: UiLocale): string {
  const wall = zagrebWall(instant);
  return wall === null ? "" : dateOf(wall, locale);
}

/** "14:05" in both languages (24-hour clock, Zagreb time). */
export function formatTime(instant: Date | string | number): string {
  const wall = zagrebWall(instant);
  return wall === null ? "" : `${two(wall.hour)}:${two(wall.minute)}`;
}

/** "21. studenoga 2026. u 14:05" or "21 November 2026 at 14:05". */
export function formatDateTime(instant: Date | string | number, locale: UiLocale): string {
  const wall = zagrebWall(instant);
  if (wall === null) return "";
  return `${dateOf(wall, locale)} ${locale === "hr" ? "u" : "at"} ${two(wall.hour)}:${two(wall.minute)}`;
}

/**
 * A number with the language's separators: 1234567.5 is "1.234.567,5" in
 * Croatian and "1,234,567.5" in English. `fractionDigits` fixes the digits
 * after the separator; without it they are kept as given, up to 6.
 */
export function formatNumber(value: number, locale: UiLocale, fractionDigits?: number): string {
  if (!Number.isFinite(value)) return "";
  const { group, decimal } = SEPARATORS[locale];
  const fixed = fractionDigits === undefined ? String(Number(value.toFixed(6))) : value.toFixed(fractionDigits);
  const negative = fixed.startsWith("-");
  const [whole = "0", fraction] = (negative ? fixed.slice(1) : fixed).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const body = fraction === undefined || fraction === "" ? grouped : `${grouped}${decimal}${fraction}`;
  return negative && /[1-9]/.test(body) ? `-${body}` : body;
}
