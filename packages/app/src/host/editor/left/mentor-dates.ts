// ED-37 (P2-6, dio 2): the key dates of the mentorship this work belongs to, in „Rokovi” of the left
// panel. Two contract reads the student already has: mentorship.student-mentorships.get names the
// student's open mentorships with their assignment, and mentorship.key-dates.get (MK-13, the same
// timeline the student sees on the mentorship page) gives that mentorship's milestones and
// consultations. The submission deadline is shown above from the assignment, so it is left out here.
// No new route; a failed read is "unavailable", never an empty list.
import migrationContracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import { readKeyDates, type KeyDatesCall } from "../../teacher/key-dates/contract";
import { keyDatesView, relativeDays, dayDiff, type KeyDateRow } from "../../teacher/key-dates/model";

type None = { readonly params: undefined; readonly query: undefined; readonly body: undefined };
type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };

/** The two reads, as createApi() gives them; tests pass a fake. */
export type MentorDatesCall = KeyDatesCall & ((id: "mentorship.student-mentorships.get", input: None) => Promise<Answer>);

const MENTORSHIPS = migrationContracts["mentorship.student-mentorships.get"].responses["200"].content["application/json"].schema as Schema;
const NONE: None = { params: undefined, query: undefined, body: undefined };

export type MentorDateRow = KeyDateRow & { readonly relative: string };

export type MentorDates =
  | { readonly kind: "loading" }
  /** The work belongs to no open mentorship of the student. */
  | { readonly kind: "none" }
  /** Ahead: milestones and consultations from today on; `past` counts the ones already gone. */
  | { readonly kind: "ready"; readonly ahead: readonly MentorDateRow[]; readonly past: number }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const UNAVAILABLE = { kind: "unavailable" } as const;

/** The mentorship whose assignment is this work, or null; an answer outside the contract is "unavailable". */
async function mentorshipOf(call: MentorDatesCall, assignmentId: string): Promise<string | null | MentorDates> {
  const result = await (call as (id: "mentorship.student-mentorships.get", input: None) => Promise<Answer>)("mentorship.student-mentorships.get", NONE);
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
  if (result.status !== 200 || !matchesSchema(MENTORSHIPS, result.body)) return UNAVAILABLE;
  const rows = (result.body as { mentorships: { mentorshipId: string; assignmentId: string | null }[] }).mentorships;
  return rows.find((m) => m.assignmentId === assignmentId)?.mentorshipId ?? null;
}

/** The key dates of this work's mentorship, split at today (Europe/Zagreb), without the submission deadline. */
export async function readMentorDates(call: MentorDatesCall, assignmentId: string, now: number = Date.now()): Promise<MentorDates> {
  try {
    const mentorship = await mentorshipOf(call, assignmentId);
    if (mentorship === null) return { kind: "none" };
    if (typeof mentorship !== "string") return mentorship;
    const view = keyDatesView(await readKeyDates(call, mentorship));
    if (view.kind === "signedOut" || view.kind === "unavailable") return { kind: view.kind };
    const rows = view.kind === "ready" ? view.rows.filter((r) => r.kind !== "deadline") : [];
    return {
      kind: "ready",
      ahead: rows.filter((r) => dayDiff(r.epoch, now) >= 0).map((r) => ({ ...r, relative: relativeDays(r.epoch, now) })),
      past: rows.filter((r) => dayDiff(r.epoch, now) < 0).length,
    };
  } catch {
    return UNAVAILABLE;
  }
}
