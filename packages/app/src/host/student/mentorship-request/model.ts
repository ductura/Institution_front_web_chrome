import {
  readMentorCandidates, readMyMentorshipRequests, submitMentorshipRequest, withdrawMentorshipRequest,
  type NewRequest, type StudentMentorshipCall, type StudentMentorshipRequest, type SubmitOutcome, type WithdrawOutcome,
} from "../../../../../../src/client/mentorship";
import { mentorshipRequestText as t } from "./messages.hr";

/** What the page says after an action: a success only from the server's answer (B-6). */
export type Note = { readonly tone: "status" | "alert"; readonly text: string };

/** Whether the list is read again after the action (the server decided something the page did not know). */
export type Followup = { readonly note: Note; readonly refresh: boolean };

export function submitNote(outcome: SubmitOutcome): Followup | null {
  switch (outcome.kind) {
    case "poslano": return { note: { tone: "status", text: t.sent }, refresh: true };
    case "vec-postoji": return { note: { tone: "alert", text: t.alreadyOpen }, refresh: true };
    case "greska": return { note: { tone: "alert", text: t.invalid }, refresh: false };
    case "nepoznat-nastavnik": return { note: { tone: "alert", text: t.teacherGone }, refresh: true };
    case "nepoznato": return { note: { tone: "alert", text: t.unknown }, refresh: false };
    default: return null;
  }
}

export function withdrawNote(outcome: WithdrawOutcome): Followup | null {
  switch (outcome.kind) {
    case "povuceno": return { note: { tone: "status", text: t.withdrawn }, refresh: true };
    case "vec-odluceno": return { note: { tone: "alert", text: t.alreadyDecided }, refresh: true };
    case "greska": return { note: { tone: "alert", text: outcome.code === "not_found" ? t.notFound : t.invalid }, refresh: outcome.code === "not_found" };
    case "nepoznato": return { note: { tone: "alert", text: t.unknown }, refresh: false };
    default: return null;
  }
}

/** One send, start to end; null after the session ended (the caller goes to sign-in). */
export async function sendRequest(call: StudentMentorshipCall, input: NewRequest): Promise<Followup | null> {
  return submitNote(await submitMentorshipRequest(call, input));
}

/** One withdrawal, start to end; null after the session ended. */
export async function withdrawRequest(call: StudentMentorshipCall, requestId: string): Promise<Followup | null> {
  return withdrawNote(await withdrawMentorshipRequest(call, requestId));
}

export { readMentorCandidates, readMyMentorshipRequests };

/** The status as text; a colour is never the only carrier. */
export function statusText(request: StudentMentorshipRequest): string {
  return t.status[request.state];
}

/** WEB-NF6-ETAPE (MK-7): the approved requests, newest decision first; each is a mentorship the student has. */
export function approvedOf(requests: readonly StudentMentorshipRequest[]): readonly StudentMentorshipRequest[] {
  return requests.filter((r) => r.state === "approved").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
}

/** WEB-NF6-ETAPE (MK-7): a declined request can go to another teacher; the same work type, no teacher chosen. */
export function canRetarget(request: StudentMentorshipRequest): boolean {
  return request.state === "declined";
}
