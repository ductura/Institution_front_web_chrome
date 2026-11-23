// The teacher's switch "Bilježi ritam tipkanja" (PIL-P1-RITAM-NASTAVNIK; Daniel 23. 11. 2026.: per course,
// and an assignment may override it). Only the routes of the contract extract (SRV #652):
// teacher.course-input-rhythm.get/put for the course, teacher.input-rhythm.get/put/delete for one
// assignment (delete = "vrati na postavku predmeta").
//
// What the screen may claim, by construction:
// - a change holds only when the server's answer names the value asked for (B-6); any other answer,
//   a broken connection or a thrown call is `unavailable` and the old state stays shown;
// - 401 is `signedOut` (the screen sends the browser to sign-in); every other refusal, 404 included,
//   is the same `unavailable`, so the screen never says whether a course or an assignment exists;
// - the level the state comes from (`source`) is the server's when it names one. The assignment GET
//   and PUT of the extract carry no `source` yet: a PUT is the assignment's own setting by definition,
//   and a GET reads as the assignment's own only when the server dates a change (`changedAt`).
import { createApi } from "./api";

export type RhythmSource = "assignment" | "course" | "default";
export type RhythmChangedBy = { readonly role: "teacher" | "mentor"; readonly name: string | null };
export type RhythmState = {
  readonly enabled: boolean;
  readonly source: RhythmSource;
  readonly changedBy: RhythmChangedBy | null;
  readonly changedAt: string | null;
};
export type RhythmAnswer = { readonly kind: "ready"; readonly state: RhythmState } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

/** One switch as the screen uses it: read, set and (for an assignment) go back to the course's setting. */
export interface RhythmSwitchPort {
  read(): Promise<RhythmAnswer>;
  set(enabled: boolean): Promise<RhythmAnswer>;
  reset?(): Promise<RhythmAnswer>;
}

type Call = ReturnType<typeof createApi>;
type Result = { readonly ok: boolean; readonly status: number; readonly body?: unknown };
type Body = { enabled: boolean; source?: RhythmSource; changedBy: RhythmChangedBy | null; changedAt: string | null };

const UNAVAILABLE = { kind: "unavailable" } as const;

/** The state of an answer, or null; `fallback` names the level when the body names none. */
function stateOf(result: Result, fallback: (body: Body) => RhythmSource, asked?: boolean): RhythmAnswer {
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
  const body = result.body as Body;
  if (typeof body?.enabled !== "boolean" || (asked !== undefined && body.enabled !== asked)) return UNAVAILABLE;
  return {
    kind: "ready",
    state: { enabled: body.enabled, source: body.source ?? fallback(body), changedBy: body.changedBy ?? null, changedAt: body.changedAt ?? null },
  };
}

async function settle(send: () => Promise<Result>, fallback: (body: Body) => RhythmSource, asked?: boolean): Promise<RhythmAnswer> {
  try {
    return stateOf(await send(), fallback, asked);
  } catch {
    return UNAVAILABLE;
  }
}

const dated = (own: RhythmSource, other: RhythmSource) => (body: Body): RhythmSource => (body.changedAt !== null ? own : other);

/** The course's switch: applies to every assignment of the course that has no setting of its own. */
export function courseRhythmPort(call: Call, courseId: string): RhythmSwitchPort {
  const params = { courseId };
  return {
    read: () => settle(() => call("teacher.course-input-rhythm.get", { params, query: undefined, body: undefined }), dated("course", "default")),
    set: (enabled) => settle(() => call("teacher.course-input-rhythm.put", { params, query: undefined, body: { enabled } }), () => "course", enabled),
  };
}

/** One assignment's switch: its own setting over the course's, and the way back to the course's. */
export function assignmentRhythmPort(call: Call, assignmentId: string): RhythmSwitchPort {
  const params = { assignmentId };
  return {
    read: () => settle(() => call("teacher.input-rhythm.get", { params, query: undefined, body: undefined }), dated("assignment", "course")),
    set: (enabled) => settle(() => call("teacher.input-rhythm.put", { params, query: undefined, body: { enabled } }), () => "assignment", enabled),
    reset: () => settle(() => call("teacher.input-rhythm.delete", { params, query: undefined, body: undefined }), dated("course", "default")),
  };
}
