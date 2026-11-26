import { PREPARATION_MAX, optionalText, type PreparationAttachment, type CloseAction, CloseWrite, ConsultationSlot, DetailState, SlotAction, SlotDetail, SlotWrite } from "../../../../../../../src/client/consultation-slots";
import { NOTE_MAX, type Assessment, type CriterionInput, type CriterionWrite, type WorkingCriterion } from "../../../../../../../src/client/teacher-working-criteria";

import { prepText, type PrepInput } from "../../mentor/mentor-model";
import { consultHr as t } from "./messages.hr";

/** The collaborator only reads and comments (INVENTAR §7 t. 5): no slot, record or criterion writes. */
export type Role = "student" | "teacher" | "collaborator";

/** The teacher answers a request, the student takes a proposal; nobody else acts on a slot. */
export function actionsFor(role: Role, slot: { readonly state: DetailState }): readonly SlotAction[] {
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
export const statusText = (role: Role, slot: { readonly state: DetailState }): string => t.slots.status[slot.state][role];
export const slotsHeading = (slots: readonly unknown[]): string => t.slots.title.replace("{count}", String(slots.length));

export function lineText(slot: { readonly state: DetailState; readonly startsAt: string }): string {
  const line = slot.state === "confirmed" ? t.slots.confirmedLine : slot.state === "countered" ? t.slots.proposedLine
    : slot.state === "requested" ? t.slots.requestedLine : t.slots.closedLine;
  return line.replace("{time}", timeText(slot.startsAt));
}

/** The list with the server's slot in its place (or added first). */
export const withSlot = <S extends { readonly id: string }>(slots: readonly S[], saved: S): S[] =>
  slots.some((s) => s.id === saved.id) ? slots.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...slots];

/**
 * MK-3: who may close a slot, and how (work.consultation-slot-close.post). The student withdraws a request
 * the teacher has not answered, the teacher declines it; either side cancels a proposed or confirmed slot
 * that still lies ahead. The collaborator only reads; a closed slot has no action.
 */
export function closeActionsFor(role: Role, slot: { readonly state: DetailState; readonly startsAt: string }, now: number): readonly CloseAction[] {
  if (role === "collaborator") return [];
  if (slot.state === "requested") return [role === "student" ? "withdraw" : "decline"];
  if ((slot.state === "countered" || slot.state === "confirmed") && Date.parse(slot.startsAt) > now) return ["cancel"];
  return [];
}

/** A slot from the older routes (no closing, maybe no topic) as a detail, keeping what the list already knew. */
export function asDetail(saved: ConsultationSlot, known?: SlotDetail): SlotDetail {
  return { ...saved, topic: saved.topic !== undefined ? saved.topic : (known?.topic ?? null), closing: null, preparation: "preparation" in saved && saved.preparation !== undefined ? (saved.preparation as SlotDetail["preparation"]) : (known?.preparation ?? null) };
}

export const topicText = (slot: { readonly topic: string | null }): string =>
  slot.topic === null ? t.slots.noTopic : t.slots.topicLine.replace("{topic}", slot.topic);

/** Who closed the slot and why, as the student and the teacher see it; null while it is open. */
export function closingText(role: Role, slot: SlotDetail): string | null {
  if (slot.closing === null) return null;
  const who = slot.closing.by === (role === "teacher" ? "teacher" : "student") ? t.slots.closedByYou : slot.closing.by === "teacher" ? t.slots.closedByTeacher : t.slots.closedByStudent;
  const reason = slot.closing.reason === null ? "" : ` ${t.slots.reasonLine.replace("{reason}", slot.closing.reason)}`;
  return `${who.replace("{time}", timeText(slot.closing.at))}${reason}`;
}

export function closeFailure(outcome: Exclude<CloseWrite, { kind: "saved" }>): string {
  return outcome.kind === "promijenjeno" ? t.slots.errors.changedClose : slotFailure(outcome);
}

export function slotFailure(outcome: Exclude<SlotWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.slots.errors.signedOut;
  if (outcome.kind === "promijenjeno") return t.slots.errors.changed;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.slots.errors.notFound : t.slots.errors.invalid;
  return t.slots.errors.unknown;
}

/** "Priloži pripremu" of a new request: off, being composed, not composable, or the text with the two counts it carries. */
export type Attach =
  | { readonly kind: "off" } | { readonly kind: "making" } | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly text: string; readonly changed: number; readonly resolved: number };
export const NO_ATTACH: Attach = { kind: "off" };

/** The composed preparation as an attachment; null when a count the page cannot know is missing (never guessed). */
export function attachFrom(input: PrepInput | null): Attach {
  if (input === null || input.changed === null || input.resolved === null) return { kind: "unavailable" };
  return { kind: "ready", text: prepText(input), changed: input.changed, resolved: input.resolved };
}

/** The attachment as the client sends it: undefined when off, null when it cannot be sent (blank or too long text). */
export function attachment(attach: Attach): PreparationAttachment | undefined | null {
  if (attach.kind === "off") return undefined;
  if (attach.kind !== "ready") return null;
  const text = optionalText(attach.text, PREPARATION_MAX);
  return text === undefined || text === null ? null : { text, changedParagraphs: attach.changed, resolvedComments: attach.resolved };
}

export type Form = { readonly open: boolean; readonly draft: string; readonly busy: boolean; readonly error: string | null; readonly topic?: string };
export const IDLE_FORM: Form = { open: false, draft: "", busy: false, error: null };

/** The open confirmation of one closing, with the optional reason as typed. */
export type Closing = { readonly action: CloseAction; readonly reason: string; readonly busy: boolean; readonly error: string | null };

/** After a write: saved closes and clears the form; anything else keeps it as typed, with the reason. */
export const afterSlotWrite = (form: Form, outcome: SlotWrite): Form =>
  outcome.kind === "saved" ? IDLE_FORM : { ...form, busy: false, error: slotFailure(outcome) };

/** The criterion's text, from its id (the server's label is only a message key). */
export const criterionTitle = (c: WorkingCriterion): string => t.criteria.names[c.id];

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
  criteria.map((c) => (c.id === saved.id ? saved : c));

export function criterionFailure(outcome: Exclude<CriterionWrite, { kind: "saved" }>): string {
  if (outcome.kind === "session-expired") return t.criteria.errors.signedOut;
  if (outcome.kind === "greska") return outcome.code === "not_found" ? t.criteria.errors.notFound : t.criteria.errors.invalid;
  return t.criteria.errors.unknown;
}

/** Only the teacher writes criteria; the student (ED-35, decision of 26. 11. 2026) and the collaborator read them. */
export const canEditCriteria = (role: Role): boolean => role === "teacher";
export const canWriteRecords = (role: Role): boolean => role === "teacher";
