// WEB-V21-KOD-POKRETANJE: the shared types and the pure parts of the code runner. The code itself runs in the
// frame page (public/code-run/frame.js); the host only builds the request and checks the answer, which comes from
// an opaque-origin frame and so is data to validate, never trusted.
export const RUN_TIMEOUT_MS = 2000;
export const MAX_RUN_TESTS = 10;
export const MAX_CODE_CHARS = 100_000;

export type CodeTest = { readonly id: string; readonly title: string; readonly input: unknown; readonly expected: unknown };
export type TestStatus = "passed" | "failed" | "timeout" | "error";
export type TestResult = { readonly id: string; readonly status: TestStatus; readonly actual?: unknown; readonly message?: string };
export type RunOutcome =
  | { readonly kind: "results"; readonly results: readonly TestResult[] }
  | { readonly kind: "missing-solve" }
  | { readonly kind: "failed" };

const STATUSES: readonly TestStatus[] = ["passed", "failed", "timeout", "error"];
const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function isCodeTest(value: unknown): value is CodeTest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && ID.test(v.id) && typeof v.title === "string" && v.title.length >= 1 && v.title.length <= 120
    && "input" in v && "expected" in v;
}

/** The tests of the student's read (`{revisionNo, language, tests}`); null when the answer is not that shape. */
export function parseCodeTests(body: unknown): readonly CodeTest[] | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { language?: unknown; tests?: unknown };
  if (b.language !== "javascript" || !Array.isArray(b.tests) || b.tests.length > MAX_RUN_TESTS) return null;
  return b.tests.every(isCodeTest) ? (b.tests as CodeTest[]) : null;
}

/** The answer of the frame for run `runId`, or null when it is not a well-formed answer to that run. */
export function parseFrameAnswer(data: unknown, runId: string, tests: readonly CodeTest[]): RunOutcome | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as { type?: unknown; runId?: unknown; missingSolve?: unknown; blocked?: unknown; results?: unknown };
  if (d.type !== "results" || d.runId !== runId) return null;
  if (d.blocked === true) return { kind: "failed" };
  if (d.missingSolve === true) return { kind: "missing-solve" };
  if (!Array.isArray(d.results) || d.results.length !== tests.length) return null;
  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i += 1) {
    const r = d.results[i] as { id?: unknown; status?: unknown; actual?: unknown; message?: unknown } | null;
    if (!r || typeof r !== "object" || r.id !== tests[i]!.id || !STATUSES.includes(r.status as TestStatus)) return null;
    results.push({
      id: tests[i]!.id, status: r.status as TestStatus,
      ...(r.status === "failed" ? { actual: r.actual } : {}),
      ...(typeof r.message === "string" ? { message: r.message.slice(0, 300) } : {}),
    });
  }
  return { kind: "results", results };
}

/** A value as short text for the result list (JSON, cut after `max` characters). */
export function show(value: unknown, max = 200): string {
  let text: string;
  try { text = JSON.stringify(value) ?? "undefined"; } catch { text = String(value); }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function countPassed(results: readonly TestResult[]): number {
  return results.filter((r) => r.status === "passed").length;
}
