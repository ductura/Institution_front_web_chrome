/**
 * WEB-DATUM-TOCKA: a Croatian date written by Intl ("27. studenoga 2026.", "27. stu 2026.") already
 * ends with the ordinal dot after the year. A sentence that ends with such a date, or puts a full stop
 * after it, must not show two dots ("2026.."). `oneDot` keeps the year's dot as the full stop, in a
 * whole sentence and in a line that is only the date. Only a dot right after four digits and a dot is
 * dropped, so "…", times ("10:00.") and other text stay as written.
 */
export function oneDot(text: string): string {
  return text.replace(/(\d{4}\.)\.(?!\.)/g, "$1");
}
