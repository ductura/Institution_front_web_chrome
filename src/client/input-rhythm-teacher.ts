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
// - the level the state comes from is the server's `source` and nothing else: the server always sends
//   it (SRV #652), so an answer without it is `unavailable`, never a level guessed from other fields.
import { createApi, type ApiResult } from "./api";

type RhythmOperation =
  | "teacher.course-input-rhythm.get" | "teacher.course-input-rhythm.put"
  | "teacher.input-rhythm.get" | "teacher.input-rhythm.put" | "teacher.input-rhythm.delete";
type SwitchBody = Extract<ApiResult<RhythmOperation>, { ok: true }>["body"];

export type RhythmSource = "assignment" | "course" | "default";
export type RhythmState = Pick<SwitchBody, "enabled" | "changedBy" | "changedAt"> & { readonly source: RhythmSource };
export type RhythmAnswer = { readonly kind: "ready"; readonly state: RhythmState } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

/** One switch as the screen uses it: read, set and (for an assignment) go back to the course's setting. */
export interface RhythmSwitchPort {
  read(): Promise<RhythmAnswer>;
  set(enabled: boolean): Promise<RhythmAnswer>;
  reset?(): Promise<RhythmAnswer>;
}

type Call = ReturnType<typeof createApi>;
const UNAVAILABLE = { kind: "unavailable" } as const;

/** The state of one answer; `asked` is the value a change asked for, which the answer must name. */
function stateOf(result: ApiResult<RhythmOperation>, asked?: boolean): RhythmAnswer {
  if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
  const body: SwitchBody = result.body;
  const source = "source" in body ? body.source : undefined;
  if (source === undefined || (asked !== undefined && body.enabled !== asked)) return UNAVAILABLE;
  return { kind: "ready", state: { enabled: body.enabled, source, changedBy: body.changedBy, changedAt: body.changedAt } };
}

async function settle(send: () => Promise<ApiResult<RhythmOperation>>, asked?: boolean): Promise<RhythmAnswer> {
  try {
    return stateOf(await send(), asked);
  } catch {
    return UNAVAILABLE;
  }
}

/** The course's switch: applies to every assignment of the course that has no setting of its own. */
export function courseRhythmPort(call: Call, courseId: string): RhythmSwitchPort {
  const params = { courseId };
  return {
    read: () => settle(() => call("teacher.course-input-rhythm.get", { params, query: undefined, body: undefined })),
    set: (enabled) => settle(() => call("teacher.course-input-rhythm.put", { params, query: undefined, body: { enabled } }), enabled),
  };
}

/** One assignment's switch: its own setting over the course's, and the way back to the course's. */
export function assignmentRhythmPort(call: Call, assignmentId: string): RhythmSwitchPort {
  const params = { assignmentId };
  return {
    read: () => settle(() => call("teacher.input-rhythm.get", { params, query: undefined, body: undefined })),
    set: (enabled) => settle(() => call("teacher.input-rhythm.put", { params, query: undefined, body: { enabled } }), enabled),
    reset: () => settle(() => call("teacher.input-rhythm.delete", { params, query: undefined, body: undefined })),
  };
}
