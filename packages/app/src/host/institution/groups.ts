/**
 * F4-OPE-R04 (OPE-20): the administrator makes a group of a course and assigns a confirmed teacher to a group over the
 * contract (institution.course-groups.post, institution.course-group-teachers.post). One attempt per call and never a
 * retry; an answer that does not prove the change is "unknown", and the screen asks to check the state.
 */

import { createApi, type ApiOptions } from "@/client/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The contract's own bounds of a group name: 1 to 80 characters, no space at either end. */
export const MAX_GROUP_NAME = 80;

export type GroupOutcome =
  | "ok" // 200 and a body that proves it
  | "invalid" // refused here without a request, or 400, 413, 415, 422
  | "unauthorized" // 401
  | "forbidden" // 403
  | "unknown"; // anything else: the change may or may not have happened

/** The name as the contract wants it (trimmed, 1..80), or null when no name can be sent. */
export function groupName(raw: string): string | null {
  const name = raw.trim();
  return name.length === 0 || [...name].length > MAX_GROUP_NAME ? null : name;
}

const refused = (status: number): GroupOutcome => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return [400, 413, 415, 422].includes(status) ? "invalid" : "unknown";
};

export async function createCourseGroup(courseId: string, rawName: string, options: ApiOptions = {}): Promise<GroupOutcome> {
  const name = groupName(rawName);
  if (name === null || !UUID.test(courseId)) return "invalid";
  try {
    const result = await createApi(options)("institution.course-groups.post", { params: { courseId }, query: undefined, body: { name } });
    return result.ok ? "ok" : refused(result.status);
  } catch {
    return "unknown";
  }
}

export async function assignGroupTeacher(groupId: string, teacherId: string, options: ApiOptions = {}): Promise<GroupOutcome> {
  if (!UUID.test(groupId) || !UUID.test(teacherId)) return "invalid";
  try {
    const result = await createApi(options)("institution.course-group-teachers.post", { params: { groupId }, query: undefined, body: { teacherId } });
    if (!result.ok) return refused(result.status);
    return result.body.assigned ? "ok" : "unknown";
  } catch {
    return "unknown";
  }
}
