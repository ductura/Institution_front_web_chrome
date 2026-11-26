// WEB-V21-KOD-TESTOVI-OBRAZAC: the teacher's read and write of one assignment's code tests, through the contract
// only (teacher.assignment-code-tests.get/put). A refusal is never an empty list: "not found" (another course's,
// unknown and malformed ids read the same), "signed out" and "unavailable" are states of their own, and a write
// whose answer was lost is "unknown", never "done".
import type { createApi } from "@/client/api";
import { attempt, isNotFound, isSignedOut } from "../../student/peer-review/read";
import type { CodeTestsBody, CodeTestsView } from "./model";

type Api = ReturnType<typeof createApi>;

export type ReadResult =
  | { readonly kind: "ok"; readonly view: CodeTestsView }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type WriteResult =
  | { readonly kind: "done"; readonly view: CodeTestsView }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the write may have been recorded. */
  | { readonly kind: "unknown" };

export type CodeTestsPort = {
  read(assignmentId: string): Promise<ReadResult>;
  write(assignmentId: string, body: CodeTestsBody): Promise<WriteResult>;
};

const INVALID = new Set(["invalid_input", "invalid_code_tests", "invalid_json", "body_too_large", "client_rejected"]);

export function codeTestsPortFor(call: () => Api): CodeTestsPort {
  return {
    async read(assignmentId) {
      const r = await attempt(() => call()("teacher.assignment-code-tests.get", { params: { assignmentId }, query: undefined, body: undefined }));
      if (r === null) return { kind: "unavailable" };
      if (r.ok) return { kind: "ok", view: r.body };
      if (isSignedOut(r)) return { kind: "signedOut" };
      return isNotFound(r) ? { kind: "notFound" } : { kind: "unavailable" };
    },
    async write(assignmentId, body) {
      const r = await attempt(() => call()("teacher.assignment-code-tests.put", { params: { assignmentId }, query: undefined, body: { language: body.language, tests: body.tests.map((t) => ({ ...t })) } }));
      if (r === null) return { kind: "unknown" };
      if (r.ok) return { kind: "done", view: r.body };
      if (isSignedOut(r)) return { kind: "signedOut" };
      if (isNotFound(r)) return { kind: "notFound" };
      if (r.status === 403) return { kind: "forbidden" };
      return INVALID.has(r.code) || r.status === 413 || r.status === 422 ? { kind: "invalid" } : { kind: "unknown" };
    },
  };
}
