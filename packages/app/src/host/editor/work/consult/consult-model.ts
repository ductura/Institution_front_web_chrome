import type { ConsultationSlot, SlotAction, SlotWrite } from "../../../../../../../src/client/consultation-slots";
import { NOTE_MAX, type Assessment, type CriterionInput, type CriterionWrite, type WorkingCriterion } from "../../../../../../../src/client/teacher-working-criteria";

import { consultHr as t } from "./messages.hr";

/** The collaborator only reads and comments (INVENTAR §7 t. 5): no slot, record or criterion writes. */
export type Role = "student" | "teacher" | "collaborator";

/** The teacher answers a request, the student takes a proposal; nobody else acts on a slot. */
export function actionsFor(role: Role, slot: ConsultationSlot): readonly SlotAction[] {
  if (role === "teacher" && slot.state === "requested") return ["confirm", "counter"];
  if (role === "student" && slot.state === "countered") return ["accept"];
  return [];
}

/** A `datetime-local` value as an ISO time with offset; null when it is empty or not a time. */
export function localToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const timeText = (iso: string): string => new Intl.DateTimeFormat("hr-HR", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
export const dateText = (day: string): string => new Intl.DateTimeFormat("hr-HR", { dateStyle: "long" }).format(new Date(`${day}T12:00:00`));
export const statusText = (role: Role, slot: ConsultationSlot): string => t.slots.status[slot.state][role];
export const slotsHeading = (slots: readonly unknown[]): string => t.slots.title.replace("{count}", String(slots.length));

export function lineText(slot: ConsultationSlot): string {
  const line = slot.state === "confirmed" ? t.slots.confirmedLine : slot.state === "countered" ? t.slots.proposedLine : t.slots.requestedLine;
  return line.replace("{time}", timeText(slot.startsAt));
}

/** The list with the server's slot in its place (or added first). */
export const withSlot = (slots: readonly ConsultationSlot[], saved: ConsultationSlot): ConsultationSlot[] =>
  slots.some((s) => s.id === saved.id) ? slots.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...slots];

export function slotFailure(outcome: Exclude<SlotWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.slots.errors.signedOut;
  if (outcome.kind === "promijenjeno") return t.slots.errors.changed;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.slots.errors.notFound : t.slots.errors.invalid;
  return t.slots.errors.unknown;
}

export type Form = { readonly open: boolean; readonly draft: string; readonly busy: boolean; readonly error: string | null };
export const IDLE_FORM: Form = { open: false, draft: "", busy: false, error: null };

/** After a write: saved closes and clears the form; anything else keeps it as typed, with the reason. */
export const afterSlotWrite = (form: Form, outcome: SlotWrite): Form =>
  outcome.kind === "saved" ? IDLE_FORM : { ...form, busy: false, error: slotFailure(outcome) };

export const doneCount = (criteria: readonly WorkingCriterion[]): number => criteria.filter((c) => c.assessment !== null).length;
export const criteriaHeading = (criteria: readonly WorkingCriterion[]): string =>
  t.criteria.title.replace("{done}", String(doneCount(criteria))).replace("{total}", String(criteria.length));

/** A click on the pressed assessment clears it (m3Rub); the note stays. */
export const assessmentChange = (c: WorkingCriterion, picked: Assessment): CriterionInput =>
  ({ assessment: c.assessment === picked ? null : picked, note: c.note });

/** The note as sent: trimmed, none when blank; null when over-long (the caller does not send). */
export function noteChange(c: WorkingCriterion, text: string): CriterionInput | null {
  const trimmed = text.trim();
  return trimmed.length > NOTE_MAX ? null : { assessment: c.assessment, note: trimmed === "" ? null : trimmed };
}

export const withCriterion = (criteria: readonly WorkingCriterion[], saved: WorkingCriterion): WorkingCriterion[] =>
  criteria.map((c) => (c.criterionId === saved.criterionId ? saved : c));

export function criterionFailure(outcome: Exclude<CriterionWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.criteria.errors.signedOut;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.criteria.errors.notFound : t.criteria.errors.invalid;
  return t.criteria.errors.unknown;
}

/** Only the teacher writes criteria; the student and the collaborator read them (WEB-2122 decision, 22. 11. 2026). */
export const canEditCriteria = (role: Role): boolean => role === "teacher";
export const canWriteRecords = (role: Role): boolean => role === "teacher";
