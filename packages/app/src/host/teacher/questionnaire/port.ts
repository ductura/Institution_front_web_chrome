// The port of the questionnaire author (WEB-V18-UPITNIK-AUTOR; server routes SRV-V18-UPITNIK-AUTOR and -ISPUNJAVANJE):
// the contract client of src/client, never a network call of its own. 401 is "signed out", 404 is "not found"
// (foreign, unknown and malformed ids look the same), 409 a conflict, 422 or a refused input "invalid"; every other
// failure, a broken connection or a body that is not the contract's shape is "unavailable", never an empty list.
import type { createApi } from "../../../../../../src/client/api";
import type { Answer, Body, ListItem, Questionnaire } from "./model";

export type Api = ReturnType<typeof createApi>;
export type Failure = "signedOut" | "notFound" | "conflict" | "invalid" | "unavailable";
export type Result<T> = { kind: "ready"; value: T } | { kind: Failure };

export type QuestionnairePort = {
  list(courseId: string): Promise<Result<ListItem[]>>;
  read(id: string): Promise<Result<Questionnaire>>;
  create(courseId: string, body: Body): Promise<Result<Questionnaire>>;
  change(id: string, body: Body): Promise<Result<Questionnaire>>;
  setState(id: string, state: "open" | "closed"): Promise<Result<"open" | "closed">>;
  addSheet(id: string, answers: Answer[]): Promise<Result<null>>;
};

function failure(status: number): Failure {
  switch (status) {
    case 401: return "signedOut";
    case 404: return "notFound";
    case 409: return "conflict";
    case 0:
    case 422: return "invalid";
    default: return "unavailable";
  }
}

/** A migration route's answer may carry no body for the type; a 200 without one is not what the contract says. */
function got<T>(body: T | undefined): Result<T> {
  return body === undefined ? { kind: "unavailable" } : { kind: "ready", value: body };
}

async function guarded<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run();
  } catch {
    return { kind: "unavailable" };
  }
}

/** The port over the contract client; tests give a client over a fake transport. */
export function questionnairePort(api: Api): QuestionnairePort {
  return {
    list: (courseId) => guarded(async () => {
      const r = await api("teacher.questionnaires.get", { params: { courseId }, query: undefined, body: undefined });
      return r.ok ? got(r.body?.questionnaires.slice()) : { kind: failure(r.status) };
    }),
    read: (id) => guarded(async () => {
      const r = await api("teacher.questionnaire.get", { params: { id }, query: undefined, body: undefined });
      return r.ok ? got(r.body) : { kind: failure(r.status) };
    }),
    create: (courseId, body) => guarded(async () => {
      const r = await api("teacher.questionnaires.post", { params: { courseId }, query: undefined, body });
      return r.ok ? got(r.body) : { kind: failure(r.status) };
    }),
    change: (id, body) => guarded(async () => {
      const r = await api("teacher.questionnaire.patch", { params: { id }, query: undefined, body });
      return r.ok ? got(r.body) : { kind: failure(r.status) };
    }),
    setState: (id, state) => guarded(async () => {
      const r = await api("teacher.questionnaire-state.post", { params: { id }, query: undefined, body: { state } });
      return r.ok ? got(r.body?.state) : { kind: failure(r.status) };
    }),
    addSheet: (id, answers) => guarded<null>(async () => {
      const r = await api("teacher.questionnaire-manual-responses.post", { params: { id }, query: undefined, body: { answers } });
      return r.ok ? { kind: "ready", value: null } : { kind: failure(r.status) };
    }),
  };
}
