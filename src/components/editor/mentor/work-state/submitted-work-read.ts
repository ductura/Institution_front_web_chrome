import { browserTransport, SERVER_PREFIX, type ApiOptions } from "../../../../client/api";
import { readSubmissionState } from "../../../../client/submission";

/** The submitted workspace has an assignment ID. The signed receipt identifies its document. */
export function readSubmittedWork(assignmentId: string, options: ApiOptions = {}) {
  return readSubmissionState(async (_id, { params }) => {
    const url = new URL(
      SERVER_PREFIX + `student/assignments/${encodeURIComponent(params.assignmentId)}/submission`,
      options.baseUrl ?? globalThis.location.origin,
    );
    const answer = await (options.fetchImpl ?? browserTransport)(url, {
      method: "GET", credentials: "include", redirect: "manual", cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (answer.status === 200 && answer.headers.get("content-type")?.startsWith("application/json")) {
      return { ok: true, status: 200, body: await answer.json() };
    }
    return { ok: false, status: answer.status, code: "unavailable" };
  }, assignmentId);
}
