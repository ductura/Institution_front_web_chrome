/**
 * "Prijavi problem" send (WEB-1806; M11.10): support.problem-report.post.
 *
 * TODO(ugovor): the route is not in @ductura/contracts yet, so the shape is
 * the one of the route's vectors (src/components/support/fixtures) and the
 * caller passes the transport (`ProblemReportCall`); only tests answer it with
 * invented answers. The body is built by buildProblemReportBody's model: no
 * work content, no name, no identifier leaves the page, only the closed list.
 */
import { outcomeFromResponse, type ProblemReportBody, type SendOutcome } from "../components/support/problem-report";

export type ProblemReportCall = (
  id: "support.problem-report.post",
  input: { readonly body: ProblemReportBody },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string; body?: unknown; retryAfter?: string | null }>;

/** The exact keys the route accepts; anything else (a work text, a title) is never added to the wire body. */
const KEYS = ["appVersion", "browser", "category", "description", "route", "syncState"] as const;

export async function sendProblemReport(call: ProblemReportCall, body: ProblemReportBody, now: number): Promise<SendOutcome> {
  const wire = Object.fromEntries(KEYS.map((key) => [key, body[key]])) as ProblemReportBody;
  const answer = await call("support.problem-report.post", { body: wire });
  const retryAfter = "retryAfter" in answer ? answer.retryAfter ?? null : null;
  return outcomeFromResponse(answer.status, answer.body ?? null, retryAfter, now);
}
