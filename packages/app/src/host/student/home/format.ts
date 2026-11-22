/** The prototype's date and time: "8. 11. 2026., 23:59", in Zagreb's time whatever zone runs the code. */
export function protoDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${Number(part("day"))}. ${Number(part("month"))}. ${part("year")}., ${part("hour")}:${part("minute")}`;
}

/** Today as the prototype's hero shows it: "5. 11. 2026." */
export function protoToday(at: Date): string {
  return protoDateTime(at.toISOString()).split(",")[0]!;
}
