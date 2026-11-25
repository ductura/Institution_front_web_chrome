import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const LIST = "support.problem-reports.get";
const STATUS = "support.problem-report-status.post";
export type ReportsData = Extract<ApiResult<typeof LIST>, { ok: true }>["body"];
export type Report = ReportsData["reports"][number];
export type ReportStatus = Report["status"];

type ReportsRead = { kind: "ready"; data: ReportsData } | { kind: "denied" | "unavailable" };
export type ReportsState = ReportsRead | { kind: "loading" };

/** NF-7 OA-7: the reports one reader may see; 401/403 is "denied", anything else "unavailable". */
export async function readReports(options?: ApiOptions): Promise<ReportsRead> {
  try {
    const answer = await createApi(options)(LIST, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return { kind: "ready", data: answer.body };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export type StatusResult = { kind: "changed"; status: ReportStatus; at: string | null } | { kind: "denied" | "gone" | "unavailable" };

/** Sets the state of one report (received or resolved); the page shows the new state only after the server's answer. */
export async function setReportStatus(reference: string, status: ReportStatus, options?: ApiOptions): Promise<StatusResult> {
  try {
    const answer = await createApi(options)(STATUS, { params: { reference }, query: undefined, body: { status } });
    if (answer.ok) return { kind: "changed", status: answer.body.status, at: answer.body.statusChangedAt };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
    if (answer.status === 404) return { kind: "gone" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
