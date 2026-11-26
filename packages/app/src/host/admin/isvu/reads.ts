// WEB-V22-UVOZ-EKRAN: the trial ISVU import over the contract (only ApiOperationId routes, one attempt per call).
import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

type SourceCourses = Extract<ApiResult<"institution.isvu-courses.get">, { ok: true }>["body"];
type Preview = Extract<ApiResult<"institution.isvu-roster-imports.post">, { ok: true }>["body"];
type Confirmed = Extract<ApiResult<"institution.roster-import-confirm.post">, { ok: true }>["body"];

export type SourceCourse = SourceCourses["courses"][number];
export type ImportPreview = Preview;
export type ImportResult = Confirmed;

/** "disabled" = 404 (the source is off, or the course is not the institution's); "expired" = 410. */
export type Failure = "signedOut" | "denied" | "disabled" | "expired" | "unavailable";
export type Outcome<T> = { kind: "ok"; value: T } | { kind: Failure };

const failure = (status: number): Failure => {
  if (status === 401) return "signedOut";
  if (status === 403) return "denied";
  if (status === 404) return "disabled";
  return status === 410 ? "expired" : "unavailable";
};

/** The courses of the trial source for one academic year. */
export async function readSourceCourses(year: string, options?: ApiOptions): Promise<Outcome<readonly SourceCourse[]>> {
  try {
    const call = createApi(options);
    const answer = await call("institution.isvu-courses.get", { params: undefined, query: { academicYear: year }, body: undefined });
    return answer.ok ? { kind: "ok", value: answer.body.courses } : { kind: failure(answer.status) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Preview of the roster; nothing is enrolled by this call. */
export async function previewImport(courseId: string, sourceCourseKey: string, options?: ApiOptions): Promise<Outcome<ImportPreview>> {
  try {
    const call = createApi(options);
    const answer = await call("institution.isvu-roster-imports.post", { params: { courseId }, query: undefined, body: { sourceCourseKey } });
    return answer.ok ? { kind: "ok", value: answer.body } : { kind: failure(answer.status) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Confirms a preview the administrator has seen. */
export async function confirmImport(importId: string, options?: ApiOptions): Promise<Outcome<ImportResult>> {
  try {
    const call = createApi(options);
    const answer = await call("institution.roster-import-confirm.post", { params: { importId }, query: undefined, body: {} });
    return answer.ok ? { kind: "ok", value: answer.body } : { kind: failure(answer.status) };
  } catch {
    return { kind: "unavailable" };
  }
}
