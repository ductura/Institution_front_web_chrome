// F4-MEN-R01 (odluka 4: mentorstvo otvara nastavnik): the student's notifications that a teacher opened a
// mentorship for them (notifications.mentorship-opened.list.get), newest first. The first page only (at most
// 50, as the server gives it); a failed read is "unavailable", never "none" (B-6).
import type { MentorshipWorkType, PersonName } from "../../../../../../src/client/mentorship";
import { WORK_TYPES } from "../../../../../../src/client/mentorship";

export type OpenedCall = (
  id: "notifications.mentorship-opened.list.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type OpenedMentorship = {
  readonly id: string;
  readonly mentorshipId: string;
  readonly workType: MentorshipWorkType;
  readonly topic: string | null;
  readonly mentorName: PersonName | null;
  readonly createdAt: string;
  /** Null while the student has not marked the notification read. */
  readonly readAt: string | null;
};

export type OpenedRead = { kind: "ready"; opened: OpenedMentorship[] } | { kind: "signedOut" } | { kind: "unavailable" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isName = (v: unknown): v is PersonName | null =>
  v === null || (isRecord(v) && typeof v.givenName === "string" && typeof v.familyName === "string");

function parse(item: unknown): OpenedMentorship | null {
  if (!isRecord(item)) return null;
  const { id, targetId, workType, topic, mentorName, createdAt, readAt } = item;
  if (typeof id !== "string" || typeof targetId !== "string" || typeof createdAt !== "string") return null;
  if (!WORK_TYPES.includes(workType as MentorshipWorkType) || (topic !== null && typeof topic !== "string") || !isName(mentorName)) return null;
  if (readAt !== null && typeof readAt !== "string") return null;
  return { id, mentorshipId: targetId, workType: workType as MentorshipWorkType, topic: topic as string | null, mentorName, createdAt, readAt };
}

export async function readOpened(call: OpenedCall): Promise<OpenedRead> {
  try {
    const result = await call("notifications.mentorship-opened.list.get", { params: undefined, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
    if (result.status !== 200 || !isRecord(result.body) || !Array.isArray(result.body.notifications)) return { kind: "unavailable" };
    const opened = result.body.notifications.map(parse);
    return opened.some((o) => o === null) ? { kind: "unavailable" } : { kind: "ready", opened: opened as OpenedMentorship[] };
  } catch {
    return { kind: "unavailable" };
  }
}

/** A mentorship opened by the teacher and one approved from an older request can be the same; the opened one stays once. */
export function withoutApproved(opened: readonly OpenedMentorship[], approvedMentorshipIds: readonly string[]): OpenedMentorship[] {
  const approved = new Set(approvedMentorshipIds);
  return opened.filter((o) => !approved.has(o.mentorshipId));
}
