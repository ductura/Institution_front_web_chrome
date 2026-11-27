// WEB-2137 (PARITET Mentor): the Mentor card's pure rules. The server gives no work-review state, no
// preparation and no "Kako radim" text yet; a missing read is "nedostupno", never a guessed value (B-6).
import type { ConsultationSlot } from "../../../../../../src/client/consultation-slots";
import type { WorkMessage } from "../../../../../../src/client/work-messages";
import type { WorkMilestone } from "../../../../../../src/client/work-milestones";

import { oneDot } from "../../../i18n/date-dot";
import { mentorCardHr as t } from "./messages.hr";

/** The collaborator only reads and comments (INVENTAR §7 t. 5). */
export type Role = "student" | "teacher" | "collaborator";

export type WorkState =
  | { kind: "draft" }
  | { kind: "review"; round: number; sentAt: string }
  | { kind: "revise"; due: string | null; mustOpen: number; request: string | null }
  | { kind: "accepted"; consentAt: string | null }
  | { kind: "submitted"; submittedAt: string | null };

export type StateView = { headline: string; sub: string | null; request: string | null; actions: readonly ActionId[] };
export type ActionId = keyof typeof t.actions;

const DAY = 86_400_000;
// A date from dateText already ends with the year's dot: a template's full stop after it is not doubled.
const fill = (text: string, values: Record<string, string | number>): string =>
  oneDot(text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? "")));
const plural = (n: number): "one" | "few" | "many" => (n % 10 === 1 && n % 100 !== 11 ? "one" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "few" : "many");

export const dateText = (iso: string): string => new Intl.DateTimeFormat("hr-HR", { dateStyle: "long" }).format(new Date(iso));

/** "danas" / "za N dan|dana" / "prije N dan|dana" (prototype inDays), by calendar day. */
export function inDays(iso: string, now: Date): string {
  const day = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / DAY);
  const n = day(new Date(iso)) - day(now);
  if (n === 0) return t.days.today;
  const set = n > 0 ? t.days.future : t.days.past;
  return fill(plural(Math.abs(n)) === "one" ? set.one : set.many, { n: Math.abs(n) });
}

const mustText = (n: number): string => (n === 0 ? t.sub.mustDone : fill(t.sub.mustOpen[plural(n)], { n }));
const dueText = (due: string | null, now: Date): string | null => (due === null ? null : fill(t.sub.due, { date: dateText(due), days: inDays(due, now) }));

/** Headline, subtitle and the actions the role may take. Nobody acts after submission; the collaborator never acts. */
export function stateView(role: Role, state: WorkState, now: Date): StateView {
  const mine = role === "student" ? "student" : role === "teacher" ? "teacher" : "collaborator";
  const none = { request: null, actions: [] as ActionId[] };
  const teacher = role === "teacher";
  const student = role === "student";
  switch (state.kind) {
    case "submitted":
      return { headline: t.headline.submitted, sub: state.submittedAt === null ? null : dateText(state.submittedAt), ...none };
    case "accepted":
      return {
        headline: t.headline.accepted[mine],
        sub: state.consentAt !== null ? fill(t.sub.consentGiven, { date: dateText(state.consentAt) })
          : teacher ? t.sub.consentMissingTeacher : t.sub.consentMissingStudent,
        request: null,
        actions: teacher && state.consentAt === null ? ["giveConsent"] : student ? ["rehearsal"] : [],
      };
    case "review":
      return {
        headline: t.headline.review[mine], sub: fill(t.sub.round, { round: state.round, date: dateText(state.sentAt) }), request: null,
        actions: teacher ? ["returnForRevision", "accept"] : [],
      };
    case "revise":
      return {
        headline: t.headline.revise[mine],
        sub: [dueText(state.due, now), mustText(state.mustOpen)].filter((p) => p !== null).join(" · "),
        request: state.request,
        actions: student ? (state.mustOpen > 0 ? ["walk"] : ["sendRevision"]) : [],
      };
    default:
      return { headline: t.headline.draft[mine], sub: t.sub.notSent, ...none, actions: student ? ["sendForReview"] : [] };
  }
}

/** "Sljedeća etapa: <ime> · rok <due> (<inDays>)" for the first stage not yet approved. */
export function nextStageLine(milestones: readonly WorkMilestone[], now: Date): string | null {
  const next = milestones.find((m) => m.state !== "approved");
  if (!next) return null;
  return next.dueAt === null ? fill(t.nextStageNoDue, { title: next.title })
    : fill(t.nextStage, { title: next.title, date: dateText(next.dueAt), days: inDays(next.dueAt, now) });
}

/** The badge: the other side's messages after `seenAt`, plus slots waiting for this role (prototype radBadge). */
export function badgeCount(role: Role, messages: readonly WorkMessage[], seenAt: string | null, slots: readonly ConsultationSlot[]): number {
  if (role === "collaborator") return 0;
  const other = role === "teacher" ? "student" : "teacher";
  const fresh = messages.filter((m) => m.senderRole === other && (seenAt === null || m.createdAt > seenAt)).length;
  const waiting = slots.filter((s) => s.state === (role === "teacher" ? "requested" : "countered")).length;
  return fresh + waiting;
}
export const badgeText = (n: number): string | null => (n > 0 ? fill(t.badge, { n, what: t.badgeWhat }) : null);

export const absStatus = (words: number | null): string => (words === null || words === 0 ? t.abs.notWritten : fill(t.abs.words, { n: words }));

export type PrepInput = {
  since: string | null; changed: number | null; resolved: number | null;
  agreed: readonly { text: string; done: boolean }[]; openComments: number | null; words: number | null; toReview: number | null;
};

/** The text sent or copied to the mentor (prototype prepText); a count the page does not know is left out. */
export function prepText(input: PrepInput): string {
  const p = t.prep;
  const first = [input.since === null ? null : fill(p.since, { date: dateText(input.since) }),
    input.changed === null ? null : fill(p.changed, { n: input.changed }),
    input.resolved === null ? null : fill(p.resolved, { n: input.resolved })].filter((x) => x !== null).join(" · ");
  const agreed = input.agreed.length === 0 ? [] : [p.agreed, ...input.agreed.map((a) => `${a.done ? "✓" : "○"} ${a.text}`)];
  const scope = input.words === null ? null : [fill(p.scope, { words: input.words }), input.toReview === null ? null : fill(p.toReview, { n: input.toReview })].filter((x) => x !== null).join(" · ");
  return [p.title, first, ...agreed, input.openComments === null ? null : fill(p.open, { n: input.openComments }), scope, p.need]
    .filter((line) => line !== null && line !== "").join("\n");
}
