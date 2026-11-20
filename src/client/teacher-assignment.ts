import { createApi, type ApiResult, type Input } from "./api";

type AssignmentFailure = { kind: "signedOut" | "notTeacher" | "notFound" | "unavailable" };
type ReadOperation = "institution.assignment.get" | "institution.work-work-language.get";
type AssignmentRead<Id extends ReadOperation> =
  | { kind: "ready"; value: Extract<ApiResult<Id>, { ok: true }>["body"] }
  | AssignmentFailure;

function readFailure(status: number, code?: string): AssignmentFailure {
  if (status === 401) return { kind: "signedOut" };
  if (status === 403) return { kind: "notTeacher" };
  if (status === 404 || status === 422 || code === "client_rejected") return { kind: "notFound" };
  return { kind: "unavailable" };
}

export async function readAssignmentVersion(
  assignmentId: string, api = createApi(),
): Promise<AssignmentRead<"institution.assignment.get">> {
  const id = assignmentId.toLowerCase();
  const result = await api("institution.assignment.get", { params: { assignmentId: id }, query: undefined, body: undefined }).catch(() => null);
  if (result === null) return { kind: "unavailable" };
  if (!result.ok) return readFailure(result.status, result.code);
  if (result.body.assignmentId !== id || !Number.isFinite(Date.parse(result.body.opensAt))
    || !Number.isFinite(Date.parse(result.body.dueAt))) return readFailure(503);
  return { kind: "ready", value: result.body };
}

export async function readWorkLanguage(
  assignmentId: string, documentId: string, api = createApi(),
): Promise<AssignmentRead<"institution.work-work-language.get">> {
  if (documentId === "." || documentId === "..") return readFailure(422);
  const result = await api("institution.work-work-language.get", {
    params: { assignmentId: assignmentId.toLowerCase(), documentId }, query: undefined, body: undefined,
  }).catch(() => null);
  if (result === null) return { kind: "unavailable" };
  return result.ok ? { kind: "ready", value: result.body } : readFailure(result.status, result.code);
}

type Language = NonNullable<Input<"institution.work-work-language.post">["body"]["language"]>;

export type WorkLanguageWrite =
  | { kind: "saved"; language: Language }
  | { kind: "unauthorized" | "forbidden" | "invalid" | "conflict" | "unavailable" };

export async function writeWorkLanguage(
  assignmentId: string, documentId: string, language: Language | null, api = createApi(),
): Promise<WorkLanguageWrite> {
  if (documentId === "." || documentId === "..") return { kind: "invalid" };
  const result = await api("institution.work-work-language.post", {
    params: { assignmentId: assignmentId.toLowerCase(), documentId }, query: undefined, body: { language },
  }).catch(() => null);
  if (result === null) return { kind: "unavailable" };
  if (result.ok) {
    return language === null || result.body.language === language
      ? { kind: "saved", language: result.body.language }
      : { kind: "unavailable" };
  }
  if (result.status === 401) return { kind: "unauthorized" };
  if (result.status === 403) return { kind: "forbidden" };
  if (result.status === 409) return { kind: "conflict" };
  if (result.code === "client_rejected" || [400, 413, 415, 422].includes(result.status)) return { kind: "invalid" };
  return { kind: "unavailable" };
}
