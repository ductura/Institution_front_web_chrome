// WEB-V18-UPITNIK-IZVOZ: the reads of the export, through the contract only (teacher.questionnaire-export.get,
// and teacher.questionnaire.get for the title). Another teacher's, an unknown and a malformed questionnaire
// read the same (404, C-23). A refusal is never an empty export: "not found", "too few", "signed out" and
// "unavailable" are states of their own. Free text is asked for only with `includeText`.
import type { createApi } from "@/client/api";
import type { QuestionnaireExport } from "./model";

type Api = ReturnType<typeof createApi>;

export type ExportRead =
  | { readonly kind: "ok"; readonly data: QuestionnaireExport }
  /** 409: fewer responses than the least number the export holds. */
  | { readonly kind: "tooFew" }
  | { readonly kind: "notFound" }
  /** 403: the role may not see this view (V18 F14: its own state, not "not found"). */
  | { readonly kind: "denied" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type TitleRead =
  | { readonly kind: "ok"; readonly title: string }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
const denied = (r: { readonly status: number; readonly code: string }) => r.status === 403 || r.code === "forbidden";
const notFound = (r: { readonly status: number; readonly code: string }) => r.status === 404 || r.code === "not_found";

/** The client rejects when the connection drops or the body cannot be read. */
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export async function readExport(call: Api, questionnaireId: string, includeText: boolean): Promise<ExportRead> {
  const query = includeText ? { includeText: "true" as const } : {};
  const r = await attempt(() => call("teacher.questionnaire-export.get", { params: { id: questionnaireId }, query, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    if (denied(r)) return { kind: "denied" };
    if (notFound(r)) return { kind: "notFound" };
    return r.status === 409 || r.code === "conflict" ? { kind: "tooFew" } : { kind: "unavailable" };
  }
  // A body of another questionnaire or of another schema is not this export.
  if (r.body.schema !== "questionnaire-export-v1" || r.body.questionnaireId !== questionnaireId) return { kind: "unavailable" };
  return { kind: "ok", data: r.body };
}

export async function readTitle(call: Api, questionnaireId: string): Promise<TitleRead> {
  const r = await attempt(() => call("teacher.questionnaire.get", { params: { id: questionnaireId }, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : notFound(r) || denied(r) ? { kind: "notFound" } : { kind: "unavailable" };
  return { kind: "ok", title: r.body.title };
}
