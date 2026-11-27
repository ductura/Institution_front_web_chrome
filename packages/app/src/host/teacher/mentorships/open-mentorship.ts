// F4-MEN-R01 (odluka 4: mentorstvo otvara nastavnik): the reads and the write of "Otvori mentorstvo".
// The students the teacher can pick are the students of the teacher's own courses (teacher.courses.get,
// then teacher.course-students.get per course), each once, by name. mentorship.open.post opens the
// mentorship; only a 201 with the mentorship's id counts as opened (B-6), every other answer says what
// the server said, and a broken connection says the outcome is not known.
import type { MentorshipWorkType } from "../../../../../../src/client/mentorship";

export type OpenCall = (
  id: "teacher.courses.get" | "teacher.course-students.get" | "mentorship.open.post",
  input: { params: { courseId: string } | undefined; query: undefined; body: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type Pickable = { readonly studentId: string; readonly name: string };
export type PickableRead =
  | { kind: "ready"; students: Pickable[] }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

export type OpenOutcome =
  | { kind: "opened"; mentorshipId: string }
  | { kind: "signedOut" }
  | { kind: "notFound" }
  | { kind: "alreadyOpen" }
  | { kind: "invalid" }
  | { kind: "noRule" }
  | { kind: "unknown" };

export const TOPIC_MAX = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const none = { query: undefined } as const;

/** The topic as the server counts it (code points); blank is no topic. */
export function topicOf(text: string): { ok: true; topic: string | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, topic: null };
  return [...trimmed].length <= TOPIC_MAX ? { ok: true, topic: trimmed } : { ok: false };
}

/** The students of every course of the teacher, each once, sorted by name. One failed roster is unavailable, never a shorter list. */
export async function readPickable(call: OpenCall): Promise<PickableRead> {
  try {
    const courses = await call("teacher.courses.get", { params: undefined, ...none, body: undefined });
    if (!courses.ok) return courses.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
    if (!isRecord(courses.body) || !Array.isArray(courses.body.courses)) return { kind: "unavailable" };
    const ids = (courses.body.courses as unknown[]).map((c) => (isRecord(c) && typeof c.id === "string" ? c.id : null));
    if (ids.some((id) => id === null)) return { kind: "unavailable" };
    const rosters = await Promise.all((ids as string[]).map((courseId) =>
      call("teacher.course-students.get", { params: { courseId }, ...none, body: undefined })));
    const byId = new Map<string, Pickable>();
    for (const roster of rosters) {
      if (!roster.ok) return roster.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
      if (!isRecord(roster.body) || !Array.isArray(roster.body.students)) return { kind: "unavailable" };
      for (const s of roster.body.students as unknown[]) {
        if (!isRecord(s) || typeof s.studentId !== "string" || !UUID.test(s.studentId)
          || typeof s.givenName !== "string" || typeof s.familyName !== "string") return { kind: "unavailable" };
        byId.set(s.studentId, { studentId: s.studentId, name: `${s.givenName} ${s.familyName}` });
      }
    }
    const students = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "hr"));
    return { kind: "ready", students };
  } catch {
    return { kind: "unavailable" };
  }
}

/** mentorship.open.post. Never throws. */
export async function openMentorship(call: OpenCall, input: { studentId: string; workType: MentorshipWorkType; topic: string | null }): Promise<OpenOutcome> {
  if (!UUID.test(input.studentId)) return { kind: "invalid" };
  const body = { studentId: input.studentId, workType: input.workType, ...(input.topic === null ? {} : { topic: input.topic }) };
  try {
    const result = await call("mentorship.open.post", { params: undefined, ...none, body });
    if (result.ok) {
      return result.status === 201 && isRecord(result.body) && typeof result.body.mentorshipId === "string" && UUID.test(result.body.mentorshipId)
        ? { kind: "opened", mentorshipId: result.body.mentorshipId } : { kind: "unknown" };
    }
    if (result.status === 401) return { kind: "signedOut" };
    if (result.status === 404) return { kind: "notFound" };
    if (result.status === 409) return { kind: "alreadyOpen" };
    if (result.status === 400 || result.status === 422) return { kind: "invalid" };
    if (result.status === 503) return { kind: "noRule" };
    return { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}
