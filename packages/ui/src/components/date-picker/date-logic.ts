/** Pure date rules of the date picker (UI-8A). Values are ISO "yyyy-mm-dd"; people see and type "d. M. yyyy." (hr-HR). */
const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const iso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

export function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidIso(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= daysIn(Number(m[1]), Number(m[2]));
}

/** "5. 11. 2026." -> "2026-11-05"; spaces and the final dot are optional; impossible dates are null. */
export function parseHrDate(text: string): string | null {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s*$/.exec(text);
  if (!m) return null;
  const value = iso(Number(m[3]), Number(m[2]), Number(m[1]));
  return isValidIso(value) ? value : null;
}

export function formatHrDate(value: string): string {
  if (!isValidIso(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
}

export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addMonths(value: string, months: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const index = y! * 12 + (m! - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return iso(year, month, Math.min(d!, daysIn(year, month)));
}

/** Weeks start on Monday (hr-HR); null pads the days outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn(year, month) }, (_, i) => iso(year, month, i + 1))];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function inRange(value: string, min?: string, max?: string): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/** Grid keys: arrows move a day / a week, PageUp/PageDown a month, Home/End the week's ends; null for other keys. */
export function gridKeyTarget(value: string, key: string): string | null {
  const weekday = (new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7;
  switch (key) {
    case "ArrowLeft": return addDays(value, -1);
    case "ArrowRight": return addDays(value, 1);
    case "ArrowUp": return addDays(value, -7);
    case "ArrowDown": return addDays(value, 7);
    case "PageUp": return addMonths(value, -1);
    case "PageDown": return addMonths(value, 1);
    case "Home": return addDays(value, -weekday);
    case "End": return addDays(value, 6 - weekday);
    default: return null;
  }
}
