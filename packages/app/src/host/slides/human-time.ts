// WEB-DIZ-B-V13 (Ductus#2059 c.7215579050, A4): the time of a revision for people, "8. prosinca 2026. u 21:14"
// (Europe/Zagreb, the whole name of the month in the genitive, "u" before the hour). No ISO, no UTC, no numeric short date.
import { zagrebEpochMs, zagrebWall } from "../../../../../src/lib/i18n/zagreb.ts";

const MONTHS = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
] as const;

const two = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "8. prosinca 2026. u 21:14"; the empty string when the text is no instant (the caller then leaves the time out). */
export function humanTime(iso: string): string {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return "";
  const w = zagrebWall(ms);
  return `${w.day}. ${MONTHS[w.month - 1]} ${w.year}. u ${two(w.hour)}:${two(w.minute)}`;
}
