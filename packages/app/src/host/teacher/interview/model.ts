// Rules of the teacher's interview page (WEB-1530), kept apart from React so they are tested directly.
import { interviewMessages as text } from "./messages.hr";
import type { InterviewOutcome, InterviewPreparation, InterviewQuestion } from "./port";

/** General questions first, then those tied to a paragraph; the student sees the same order. */
export function orderedQuestions(questions: readonly InterviewQuestion[]): InterviewQuestion[] {
  return [...questions].sort((a, b) => Number(a.paragraphRef !== null) - Number(b.paragraphRef !== null));
}

export const questionError = (value: string): string | null => (value.trim() === "" ? text.questionEmpty : null);

export const isInvited = (p: InterviewPreparation): boolean => p.invitedAt !== null;

/** Date and time in the Croatian form, in Zagreb time (the server speaks UTC). */
export function momentHr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const zone = { timeZone: "Europe/Zagreb" } as const;
  const date = new Intl.DateTimeFormat("hr-HR", { ...zone, day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("hr-HR", { ...zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${date} u ${time}`;
}

export function dateHr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("hr-HR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function appointmentLine(p: InterviewPreparation): string {
  const a = p.appointment;
  if (a === null) return text.appointmentNone;
  if ("consultationSlotId" in a) return `${text.appointmentSlot}: ${momentHr(a.startsAt)}`;
  return text.appointmentFree(a.place, momentHr(a.at));
}

/** "2026-11-24" + "10:30" in Zagreb time -> the UTC instant the contract wants; null when invalid. */
export function zagrebToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = shown - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

/** "Odlomak 3" for a number; anything else a server may hold is shown as it is. */
export const paragraphLabel = (ref: string | null): string =>
  ref === null ? text.generalParagraph : /^\d+$/.test(ref) ? text.paragraphN(ref) : ref;

/** The teacher types only the number (or nothing); null when the input is not a number. */
export function paragraphRefOf(input: string): { ok: true; value: string | null } | { ok: false } {
  const v = input.trim();
  if (v === "") return { ok: true, value: null };
  return /^\d{1,4}$/.test(v) && Number(v) > 0 ? { ok: true, value: String(Number(v)) } : { ok: false };
}

/** null for 401: the shell leads to the AAI@EduHr sign-in and the page shows no message (A3). */
export function failureMessage(outcome: Exclude<InterviewOutcome<unknown>, { kind: "ok" }>): string | null {
  switch (outcome.kind) {
    case "signedOut": return null;
    case "notFound": return text.notFound;
    case "conflict": return text.conflict;
    case "rejected": return text.rejected;
    default: return text.failed;
  }
}

/** The PDF the server sends as standard Base64, as bytes for a Blob download. */
export function pdfBytes(file: { pdfBase64: string }): Uint8Array<ArrayBuffer> {
  const raw = atob(file.pdfBase64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
