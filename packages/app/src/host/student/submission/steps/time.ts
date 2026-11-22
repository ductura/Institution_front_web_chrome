// VIZ-S4: the times of steps 3 to 5 as the prototype writes them (Ductura_student.html, fmt(), day(), zoned()):
// "5. 11. 2026. u 21:14", numeric day and month, Europe/Zagreb. A plain module, tested without rendering.
import { zagrebEpochMs, zagrebOffset, zagrebWall } from "../../../../../../../src/lib/i18n/zagreb.ts";

const two = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "5. 11. 2026.", or null when the text is no instant. */
export function dayOf(iso: string): string | null {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return null;
  const w = zagrebWall(ms);
  return `${w.day}. ${w.month}. ${w.year}.`;
}

/** "21:14". */
export function clockOf(iso: string): string | null {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return null;
  const w = zagrebWall(ms);
  return `${two(w.hour)}:${two(w.minute)}`;
}

/** "5. 11. 2026. u 21:14"; the raw text when it cannot be read. */
export function atOf(iso: string): string {
  const day = dayOf(iso);
  const clock = clockOf(iso);
  return day === null || clock === null ? iso : `${day} u ${clock}`;
}

/** "5. 11. 2026. u 21:14 (UTC+1)"; "(UTC+2)" in summer time. */
export function zonedOf(iso: string): string {
  const base = atOf(iso);
  if (zagrebEpochMs(iso) === null) return base;
  return `${base} (UTC+${zagrebOffset(iso) === "+01:00" ? 1 : 2})`;
}
