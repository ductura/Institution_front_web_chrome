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
  return new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function dateHr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return y && m && d ? `${d}. ${m}. ${y}.` : isoDate;
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

export function failureMessage(outcome: Exclude<InterviewOutcome<unknown>, { kind: "ok" }>): string {
  switch (outcome.kind) {
    case "signedOut": return text.signedOut;
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
