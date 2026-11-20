import type { ConsultationSlot, SlotAction, SlotWrite } from "@/client/consultation-slots";

import { consultationSlotsHr as t } from "./messages.hr";

export type Role = "student" | "teacher";

/** What the person may do with a slot: the teacher answers a request, the student takes a proposal. */
export function actionsFor(role: Role, slot: ConsultationSlot): readonly SlotAction[] {
  if (role === "teacher" && slot.status === "requested") return ["confirm", "propose"];
  if (role === "student" && slot.status === "proposed") return ["accept"];
  return [];
}

/** A `datetime-local` value ("2026-11-21T13:00") as an ISO time with offset; null when it is empty or not a time. */
export function localToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The time as shown: Croatian date and 24-hour time, in the browser's zone. */
export const timeText = (iso: string): string =>
  new Intl.DateTimeFormat("hr-HR", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

export const statusText = (role: Role, slot: ConsultationSlot): string => t.status[slot.status][role];

export function lineText(slot: ConsultationSlot): string {
  const line = slot.status === "confirmed" ? t.confirmedLine : slot.status === "proposed" ? t.proposedLine : t.requestedLine;
  return line.replace("{time}", timeText(slot.startsAt));
}

export const headingText = (slots: readonly ConsultationSlot[]): string => t.title.replace("{count}", String(slots.length));

/** The list with the server's slot in its place (or added first); the others are untouched. */
export function withSlot(slots: readonly ConsultationSlot[], saved: ConsultationSlot): ConsultationSlot[] {
  return slots.some((s) => s.slotId === saved.slotId)
    ? slots.map((s) => (s.slotId === saved.slotId ? saved : s))
    : [saved, ...slots];
}

/** What the card says after a write that did not save. A success is shown only from the server's answer (B-6). */
export function failureText(outcome: Exclude<SlotWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.errors.signedOut;
  if (outcome.kind === "promijenjeno") return t.errors.changed;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.errors.notFound : t.errors.invalid;
  return t.errors.unknown;
}

export type Form = { readonly open: boolean; readonly draft: string; readonly busy: boolean; readonly error: string | null };
export const IDLE_FORM: Form = { open: false, draft: "", busy: false, error: null };

/** After a write: saved closes and clears the form; anything else keeps it as typed, with the reason. */
export function afterWrite(form: Form, outcome: SlotWrite): Form {
  if (outcome.kind === "saved") return IDLE_FORM;
  return { ...form, busy: false, error: failureText(outcome) };
}
