/**
 * LOK-WEB-8: the administrator's reads and role actions of /ustanova, /ustanova/korisnici and
 * /ustanova/kolegiji over the contract (institution.teacher-roles.get, institution.admin-courses.get,
 * institution.academic-years.get, institution.role-confirmation.post, institution.role-revocation.post).
 * One attempt per call and never a retry; a role action whose answer does not prove the outcome is
 * "unknown", and the screen asks to check the state.
 */

import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

type Roles = Extract<ApiResult<"institution.teacher-roles.get">, { ok: true }>["body"];
type Courses = Extract<ApiResult<"institution.admin-courses.get">, { ok: true }>["body"];

export type PersonName = { readonly givenName: string; readonly familyName: string } | null;
export type TeacherRoles = Roles;
export type InstitutionCourse = Courses["courses"][number];

export type FailedKind = "signedOut" | "denied" | "unavailable";
export type Read<T> = { kind: "ok"; value: T } | { kind: FailedKind };

/** 401 is signed out, 403 is denied; anything else that is not a 200 is unavailable. */
export function failed(status: number): FailedKind {
  if (status === 401) return "signedOut";
  return status === 403 ? "denied" : "unavailable";
}

export async function readTeacherRoles(options: ApiOptions = {}): Promise<Read<TeacherRoles>> {
  let result: ApiResult<"institution.teacher-roles.get">;
  try {
    result = await createApi(options)("institution.teacher-roles.get", { params: undefined, query: {}, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok", value: result.body } : { kind: failed(result.status) };
}

/** The institution's academic years, newest first as the server lists them. */
export async function readAcademicYears(options: ApiOptions = {}): Promise<Read<readonly string[]>> {
  let result: ApiResult<"institution.academic-years.get">;
  try {
    result = await createApi(options)("institution.academic-years.get", { params: undefined, query: {}, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok", value: result.body.years } : { kind: failed(result.status) };
}

/** The courses of one academic year; an answer for another year than the asked one is unavailable. */
export async function readAdminCourses(year: string, options: ApiOptions = {}): Promise<Read<readonly InstitutionCourse[]>> {
  let result: ApiResult<"institution.admin-courses.get">;
  try {
    result = await createApi(options)("institution.admin-courses.get", { params: undefined, query: { academicYear: year }, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) return { kind: failed(result.status) };
  return result.body.academicYear === year ? { kind: "ok", value: result.body.courses } : { kind: "unavailable" };
}

export type RoleAction = "confirm" | "revoke";
export type RoleOutcome = {
  kind:
    | "confirmed" // 200 {confirmed: true}
    | "revoked" // 200 {revoked: true}
    | "notConfirmed" // 200 {revoked: false}: nothing to revoke any more
    | "notCandidate" // 404 on confirm: no longer waiting here
    | "unauthorized" // 401
    | "forbidden" // 403
    | "invalid" // 400, 413, 415, 422
    | "unknown"; // anything else: the change may or may not have happened
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Confirms or revokes the teacher role of one person. */
export async function changeTeacherRole(action: RoleAction, personId: string, options: ApiOptions = {}): Promise<RoleOutcome> {
  if (!UUID.test(personId)) return { kind: "invalid" };
  const input = { params: { teacherId: personId }, query: undefined, body: {} } as const;
  try {
    const api = createApi(options);
    if (action === "confirm") {
      const result = await api("institution.role-confirmation.post", input);
      if (result.ok) return { kind: "confirmed" };
      return { kind: statusKind(result.status, true) };
    }
    const result = await api("institution.role-revocation.post", input);
    if (result.ok) return { kind: result.body.revoked ? "revoked" : "notConfirmed" };
    return { kind: statusKind(result.status, false) };
  } catch {
    return { kind: "unknown" };
  }
}

function statusKind(status: number, confirming: boolean): RoleOutcome["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if ([400, 413, 415, 422].includes(status)) return "invalid";
  return confirming && status === 404 ? "notCandidate" : "unknown";
}

export type StudentAction = "remove" | "return";
export type StudentOutcome = {
  kind:
    | "done" // 200 with true: removed, or return permitted
    | "nothing" // 200 with false: the student was not enrolled (remove) or nothing changed (return)
    | "unauthorized" // 401
    | "forbidden" // 403
    | "invalid" // 400, 413, 415, 422
    | "unknown"; // anything else: the change may or may not have happened
};

/** Removes a student from a course, or permits the student's return, over the existing routes. */
export async function changeCourseStudent(
  action: StudentAction, courseId: string, studentId: string, options: ApiOptions = {},
): Promise<StudentOutcome> {
  if (!UUID.test(courseId) || !UUID.test(studentId)) return { kind: "invalid" };
  const input = { params: { courseId, studentId }, query: undefined, body: {} } as const;
  try {
    const api = createApi(options);
    const result = action === "remove"
      ? await api("institution.student-removal.post", input)
      : await api("institution.student-return.post", input);
    if (result.ok) {
      const yes = action === "remove"
        ? (result.body as { removed: boolean }).removed
        : (result.body as { allowed: boolean }).allowed;
      return { kind: yes ? "done" : "nothing" };
    }
    return { kind: studentStatus(result.status) };
  } catch {
    return { kind: "unknown" };
  }
}

function studentStatus(status: number): StudentOutcome["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return [400, 413, 415, 422].includes(status) ? "invalid" : "unknown";
}
