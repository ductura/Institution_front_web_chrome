import { createApi, type ApiResult } from "./api";

type Roles = Extract<ApiResult<"institution.teacher-roles.get">, { ok: true }>["body"];

/** A confirmed teacher of the institution; personId is the holderId institution.admin-courses.post takes. */
export type CourseHolderChoice = { readonly personId: string; readonly name: { readonly givenName: string; readonly familyName: string } | null };

export type CourseHoldersRead =
  | { kind: "ready"; holders: readonly CourseHolderChoice[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };

/** The confirmed teachers, in the server's order (family name, given name, id; unnamed last), for the holder choice of a new course. */
export function courseHolders(roles: Pick<Roles, "confirmed">): readonly CourseHolderChoice[] {
  return roles.confirmed.map(({ personId, name }) => ({ personId, name }));
}

/** institution.teacher-roles.get through the shared client; the administrator picks a holder by name (U-01). */
export async function readCourseHolders(api = createApi()): Promise<CourseHoldersRead> {
  try {
    const result = await api("institution.teacher-roles.get", { params: undefined, query: {}, body: undefined });
    if (result.ok) return { kind: "ready", holders: courseHolders(result.body) };
    if (result.status === 401) return { kind: "signedOut" };
    return { kind: result.status === 403 ? "forbidden" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
