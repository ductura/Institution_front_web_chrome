// The real DirectEditPort over the shared client (PIL-K-IZRAVNE-IZMJENE): work.direct-edit.get
// reads the student's setting, work.direct-edit.put changes it. The routes speak in modes
// ("direct" allows the teacher's direct edits, "suggestions" does not) and name a work by its
// document. The state a write returns is the state the server answered with (B-6); the page
// never assumes the requested one. fake-port.ts stays the stand-in for the tests.
import { createApi, type ApiOptions, type ApiResult } from "@/client/api";
import type { DirectEditPort, DirectEditRead, DirectEditState, DirectEditWrite } from "./model";

type Mode = "suggestions" | "direct";

function stateOf(answer: { readonly mode: Mode; readonly changedAt: string | null }): DirectEditState {
  return { enabled: answer.mode === "direct", changedAt: answer.changedAt };
}

function isSignedOut(result: { readonly ok: false; readonly status: number }): boolean {
  return result.status === 401;
}

/** Read: anything but the declared answer or a 401 leaves the setting unknown. */
export function readOutcome(result: ApiResult<"work.direct-edit.get">): DirectEditRead {
  if (result.ok) return { kind: "ready", state: stateOf(result.body) };
  return isSignedOut(result) ? { kind: "signedOut" } : { kind: "unavailable" };
}

/**
 * Write: a declared answer is recorded with the server's mode; a refusal the server named
 * (or one the client made before sending) is rejected; a 5xx, an unreadable or undeclared
 * answer may or may not have been applied, so it is unknown.
 */
export function writeOutcome(result: ApiResult<"work.direct-edit.put">): DirectEditWrite {
  if (result.ok) return { kind: "recorded", state: stateOf(result.body) };
  if (isSignedOut(result)) return { kind: "signedOut" };
  if (result.code === "client_rejected") return { kind: "rejected" };
  if (result.status >= 400 && result.status < 500 && result.code !== "unexpected") return { kind: "rejected" };
  return { kind: "unknown" };
}

export function directEditPort(options?: ApiOptions): DirectEditPort {
  return {
    async read(documentId) {
      try {
        const call = createApi(options);
        return readOutcome(await call("work.direct-edit.get", { params: { documentId }, query: undefined, body: undefined }));
      } catch {
        return { kind: "unavailable" };
      }
    },
    async write(documentId, enabled) {
      try {
        const call = createApi(options);
        const mode: Mode = enabled ? "direct" : "suggestions";
        return writeOutcome(await call("work.direct-edit.put", { params: { documentId }, query: undefined, body: { mode } }));
      } catch {
        return { kind: "unknown" };
      }
    },
  };
}
