// An in-memory grade route for the tests (PIL-D1-BEZ-OCJENE); invented data only.
import type { GradeCall } from "./contract";

export function fakeGradeServer(answer: "graded" | "practice" | 401 | 403 | 404 | 503 | "bad" = "graded") {
  const asked: string[] = [];
  const call: GradeCall = async (_id, input) => {
    asked.push(input.params.assignmentId ?? "");
    if (answer === "graded") return { ok: true as const, status: 200, body: { eligible: true } };
    if (answer === "bad") return { ok: true as const, status: 200, body: { eligible: true, grade: 5 } };
    if (answer === "practice") return { ok: false as const, status: 409, code: "practice_assignment" };
    const code = answer === 401 ? "unauthorized" : answer === 403 ? "forbidden" : answer === 404 ? "not_found" : "unavailable";
    return { ok: false as const, status: answer, code };
  };
  return { call, asked };
}
