// WEB-NF6-RUNDA (NF-6 MK-8): "Što je mentor rekao" on the student's side of the Mentor card. The whole-work
// return (notifications.returned-for-revision) gives the mentor's comment and the deadline; the requests on
// the text give what is still open. Nothing here is guessed: a missing read stays "nedostupno" (B-6).
import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { dateText, inDays, type WorkState } from "./mentor-model";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.said;

/** One whole-work return, as notifications.returned-for-revision.list.get gives it. */
export type ReturnNotice = { readonly documentId: string; readonly comment: string; readonly revisionDueAt: string | null; readonly createdAt: string };

const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
const plural = (n: number): "one" | "few" | "many" =>
  n % 10 === 1 && n % 100 !== 11 ? "one" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "few" : "many";

/** The newest return of this work; null when there is none. */
export function latestReturn(notices: readonly ReturnNotice[], documentId: string): ReturnNotice | null {
  return notices.filter((n) => n.documentId === documentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** Requests on the text that wait for the student. */
export const openRequests = (requests: readonly RevisionRequest[]): number =>
  requests.filter((r) => r.state === "open" || r.state === "reopened").length;

/**
 * The return still belongs to the round in progress: once the mentor accepted a request on the text after
 * it, that round was reviewed, so its comment and deadline must not be shown for a later round
 * (#631 review 2, point 5). null when there is no current return.
 */
export function currentReturn(ret: ReturnNotice | null, requests: readonly RevisionRequest[]): ReturnNotice | null {
  if (ret === null) return null;
  const reviewedAfter = requests.some((r) => r.versions.some((v) => v.closed?.as === "accepted" && v.closed.window > ret.createdAt));
  return reviewedAfter ? null : ret;
}

/** A state in revision takes the deadline (and, without an instruction, the comment) of the latest return. */
export function withReturn(state: WorkState | null | undefined, ret: ReturnNotice | null): WorkState | null | undefined {
  if (!state || state.kind !== "revise" || ret === null) return state;
  return { ...state, due: state.due ?? ret.revisionDueAt, request: state.request ?? ret.comment };
}

export type SaidView = { readonly returned: string | null; readonly due: string | null; readonly comment: string | null; readonly open: string };

/** What the card shows under "Što je mentor rekao"; null when the mentor has said nothing yet (empty state). */
export function saidView(ret: ReturnNotice | null, requests: readonly RevisionRequest[], now: Date): SaidView | null {
  const open = openRequests(requests);
  if (ret === null && open === 0) return null;
  return {
    returned: ret === null ? null : fill(t.returned, { date: dateText(ret.createdAt) }),
    due: ret === null ? null : ret.revisionDueAt === null ? t.noDue : fill(t.due, { date: dateText(ret.revisionDueAt), days: inDays(ret.revisionDueAt, now) }),
    comment: ret?.comment ?? null,
    open: open === 0 ? t.noneOpen : fill(t.open[plural(open)], { n: open }),
  };
}
