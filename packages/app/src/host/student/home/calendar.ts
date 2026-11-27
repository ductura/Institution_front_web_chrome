// F4-STU-R12 (NF-1 P-14, INVENTAR E-2f, R-49): the deadlines of the home as an iCalendar file (RFC 5545),
// made in the browser. Only the title, the course and the deadline go in; nothing is sent to the server,
// and a later change of a deadline does not reach a calendar that imported the file.
import type { TaskRow } from "./model";

export const ICS_FILE = "ductura-rokovi.ics";

const pad = (n: number) => String(n).padStart(2, "0");

/** A moment as an iCalendar UTC date-time: `YYYYMMDDTHHMMSSZ`. */
export function icsDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** A TEXT value: backslash, semicolon and comma escaped, a line break as `\n`. */
export function icsText(value: string): string {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, "\\n");
}

/** A content line folded to at most 75 octets, each continuation starting with one space; a character is never split. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The rows a calendar can take: not submitted, with a deadline that is a date. */
export function exportable(rows: readonly TaskRow[]): TaskRow[] {
  return rows.filter((row) => row.kind !== "predano" && !Number.isNaN(Date.parse(row.dueAt)));
}

/**
 * The file for the rows that are not submitted, one event per deadline ("Rok: naslov (kolegij)"), or null when
 * there is none. The deadline is the one that applies (an extended one replaces the original).
 */
export function deadlinesIcs(rows: readonly TaskRow[], now: number): { readonly text: string; readonly count: number } | null {
  const list = exportable(rows);
  if (list.length === 0) return null;
  const stamp = icsDate(now);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ductura//student//HR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const row of list) {
    const due = icsDate(Date.parse(row.dueAt));
    lines.push(
      "BEGIN:VEVENT", `UID:${icsText(row.id)}@ductura.invalid`, `DTSTAMP:${stamp}`, `DTSTART:${due}`, `DTEND:${due}`,
      `SUMMARY:${icsText(`Rok: ${row.title} (${row.course})`)}`, "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return { text: `${lines.map(foldLine).join("\r\n")}\r\n`, count: list.length };
}
