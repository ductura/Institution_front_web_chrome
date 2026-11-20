import { addDays, addMonths, gridKeyTarget, inRange, isValidIso } from "../date-picker/date-logic";

/** Appointment calendar rules (WEB-1107). A moment is local "yyyy-mm-ddTHH:MM"; the calendar never talks to a network. */
export type AppointmentStatus = "proposed" | "confirmed";
export type Appointment = { id: string; at: string; status: AppointmentStatus };

export type Moment = { date: string; time: string };

export const DEFAULT_SLOTS: readonly string[] = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

const MOMENT = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

export function parseMoment(value: string): Moment | null {
  const m = MOMENT.exec(value);
  if (m === null || !isValidIso(m[1]!)) return null;
  return { date: m[1]!, time: `${m[2]}:${m[3]}` };
}

export function formatMoment(moment: Moment): string {
  return `${moment.date}T${moment.time}`;
}

/** The same moment in gives the same moment out: what the caller stored comes back unchanged. */
export function roundTrip(value: string): string | null {
  const parsed = parseMoment(value);
  return parsed === null ? null : formatMoment(parsed);
}

/** Month shown on (re)opening: the selected moment first, then the earliest appointment, then today. */
export function openingFocus(selected: string, appointments: readonly Appointment[], today: string): string {
  const moment = parseMoment(selected);
  if (moment !== null) return moment.date;
  const first = appointments.map((a) => parseMoment(a.at)).filter((m): m is Moment => m !== null).map((m) => m.date).sort()[0];
  return first ?? today;
}

/** Appointment marks of one day: confirmed outranks proposed. */
export function dayMark(day: string, appointments: readonly Appointment[]): AppointmentStatus | null {
  let mark: AppointmentStatus | null = null;
  for (const a of appointments) {
    if (!a.at.startsWith(day)) continue;
    if (a.status === "confirmed") return "confirmed";
    mark = "proposed";
  }
  return mark;
}

export function slotMark(day: string, time: string, appointments: readonly Appointment[]): AppointmentStatus | null {
  return appointments.find((a) => a.at === `${day}T${time}`)?.status ?? null;
}

/** Selecting a day keeps the chosen time; a moment exists only once both are set. */
export function selectDay(day: string, time: string, min?: string, max?: string): Moment | null {
  return time !== "" && inRange(day, min, max) ? { date: day, time } : null;
}

/** Keeps a focus day inside min/max so the grid always has an enabled entry point. */
export function clampDay(day: string, min?: string, max?: string): string {
  if (min !== undefined && day < min) return min;
  if (max !== undefined && day > max) return max;
  return day;
}

export { addDays, addMonths, gridKeyTarget };
