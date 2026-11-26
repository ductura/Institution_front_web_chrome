// WEB-V21-KOD-POKRETANJE: the tests of an assignment as the student reads them (student.assignment-code-tests.get,
// read only). The three outcomes that must stay apart: tests, none for this assignment (or not the student's: 404),
// and "could not read" (503 or a broken answer), which is never shown as "no tests".
import { createApi } from "../../../../../../src/client/api.ts";

import { parseCodeTests, type CodeTest } from "./runner.ts";

export type CodeTestsRead =
  | { readonly kind: "ready"; readonly tests: readonly CodeTest[] }
  | { readonly kind: "none" }
  | { readonly kind: "unavailable" };

export type ReadCodeTests = (assignmentId: string) => Promise<{ ok: true; body: unknown } | { ok: false; status?: number }>;

const readFromServer: ReadCodeTests = (assignmentId) => createApi()("student.assignment-code-tests.get", {
  params: { assignmentId }, query: undefined, body: undefined,
});

export async function readCodeTests(assignmentId: string, read: ReadCodeTests = readFromServer): Promise<CodeTestsRead> {
  const result = await read(assignmentId).catch(() => ({ ok: false } as const));
  if (!result.ok) return "status" in result && result.status === 404 ? { kind: "none" } : { kind: "unavailable" };
  const tests = parseCodeTests(result.body);
  if (!tests) return { kind: "unavailable" };
  return tests.length === 0 ? { kind: "none" } : { kind: "ready", tests };
}
