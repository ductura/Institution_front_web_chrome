// ED-07 (NF2-P18): the report sent from the stopped-sending notice. It names the state (syncState ERROR) and the
// kind (technical) and carries the student's optional note; the text of the work never goes into it.
import { createApi } from "@/client/api";
import { buildProblemReportBody, type ProblemReportBody } from "@/components/support/problem-report";
import type { ProblemReportCall } from "@/components/support/problem-report-send";

import { stoppedReportHr as t } from "./messages.hr";

export const STOPPED_APP_VERSION = "0.1.0";

/** The report's body, or null when the note cannot be sent as written. An empty note says what stopped. */
export function stoppedReportBody(note: string, pathname: string, userAgent: string): ProblemReportBody | null {
  return buildProblemReportBody({
    appVersion: STOPPED_APP_VERSION,
    category: "technical",
    description: note.trim() === "" ? t.defaultNote : note,
    pathname,
    syncState: "ERROR",
    userAgent,
  });
}

/** The transport: the generated client, so every network call goes through src/client. */
export const stoppedReportCall: ProblemReportCall = async (id, input) => {
  const api = createApi() as unknown as (id: string, input: unknown) => Promise<{ ok: boolean; status: number; body?: unknown }>;
  const answer = await api(id, input);
  return answer.ok ? { ok: true, status: answer.status, body: answer.body } : { ok: false, status: answer.status, body: answer.body };
};
