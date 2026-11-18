/**
 * Croatian date and clock time in Europe/Zagreb: `19. rujna 2026. u 14:05`.
 *
 * Thin adapter, not a port. Ductus `checkpoints.ts` imports `formatDateTimeHr`
 * from `src/lib/i18n/hr.ts`; in this repo the Zagreb clock is
 * `src/components/i18n/zagreb.ts`, application code a package may not import,
 * and the formatter itself has not been ported. The body below is the Ductus
 * one at 0cdb0f1 (`hr.ts` `formatDateTimeHr` and `formatDateHr`, `zagreb.ts`
 * `zagrebWall` and `zagrebEpochMs`), so the text is the same; the adapter test
 * compares it with the application's clock for every kind of input.
 *
 * No `Intl` and no local-time `Date` getters, as in Ductus: both follow the
 * host. Summer time (UTC+2) runs from 01:00 UTC on the last Sunday of March to
 * 01:00 UTC on the last Sunday of October, otherwise UTC+1.
 */

const HOUR_MS = 3_600_000;

const MONTHS_GENITIVE_HR = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
] as const;

/** A minute with no seconds and no zone, read as Zagreb time. */
const LOCAL_MINUTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type Wall = { year: number; month: number; day: number; hour: number; minute: number };

function lastSundayOneUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
}

function wallAt(epochMs: number): Wall {
  const year = new Date(epochMs).getUTCFullYear();
  const summer = epochMs >= lastSundayOneUtc(year, 2) && epochMs < lastSundayOneUtc(year, 9);
  const wall = new Date(epochMs + (summer ? 2 : 1) * HOUR_MS);
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
  };
}

function epochOfLocalMinute(local: string): number | null {
  const match = LOCAL_MINUTE.exec(local);
  if (match === null) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  if (year < 1) return null;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  for (const offset of [2 * HOUR_MS, HOUR_MS]) {
    const wall = wallAt(asUtc - offset);
    if (wall.year === year && wall.month === month && wall.day === day && wall.hour === hour && wall.minute === minute) {
      // Through the ISO text, as Ductus does, so the same instant comes out.
      return Date.parse(new Date(asUtc - offset).toISOString());
    }
  }
  return null;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** The text, or the input unchanged when it cannot be read as an instant. */
export function formatDateTimeHr(iso: string): string {
  const epochMs = LOCAL_MINUTE.test(iso) ? epochOfLocalMinute(iso) : Date.parse(iso);
  if (epochMs === null || Number.isNaN(epochMs)) return iso;
  const at = wallAt(epochMs);
  return `${at.day}. ${MONTHS_GENITIVE_HR[at.month - 1]} ${at.year}. u ${pad2(at.hour)}:${pad2(at.minute)}`;
}
