import { createApi, type ApiResult } from "./api";

type Scope = Extract<ApiResult<"institution.teaching-team-view.get">, { ok: true }>["body"];
type HolderScope = Extract<Scope, { role: "holder" }>;

export type TeachingTeamView =
  | (HolderScope & { assistantIds: string[] })
  | Extract<Scope, { role: "assistant" }>;

export type TeachingTeamFailure = "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";
type Failure = { kind: TeachingTeamFailure };
type Read = { kind: "ready"; view: TeachingTeamView } | Failure;
type Saved = { kind: "saved" } | Failure;

function failure(status: number): Failure {
  switch (status) {
    case 401: return { kind: "signedOut" };
    case 403: return { kind: "forbidden" };
    case 409: return { kind: "conflict" };
    case 0:
    case 422: return { kind: "invalid" };
    default: return { kind: "unavailable" };
  }
}

const unavailable = { kind: "unavailable" } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = { kind: "invalid" } as const;

/** The contract's bounds of a group name: 1 to 80 characters, no space at either end; null when none can be sent. */
export const MAX_GROUP_NAME = 80;
export function groupName(raw: string): string | null {
  const name = raw.trim();
  return name.length === 0 || [...name].length > MAX_GROUP_NAME ? null : name;
}

export function createTeachingTeam(courseId: string, api = createApi()) {
  const params = { id: courseId };
  return {
    async read(): Promise<Read> {
      try {
        // The view supplies the caller's course role and only their visible groups (SRV-2007).
        const scope = await api("institution.teaching-team-view.get", { params, query: undefined, body: undefined });
        if (!scope.ok) return failure(scope.status);
        if (scope.body.role === "assistant") return { kind: "ready", view: scope.body };

        const team = await api("institution.teaching-team.get", { params, query: undefined, body: undefined });
        if (!team.ok) return failure(team.status);
        const assistantIds = team.body.assistantIds;
        const directoryIds = new Set(scope.body.assistants.map(({ id }) => id));
        const activeIds = new Set(assistantIds);
        const groupIds = new Set(scope.body.groups.map(({ id }) => id));
        if (team.body.holderId !== scope.body.holderId ||
          assistantIds.some((id) => !directoryIds.has(id)) ||
          scope.body.groups.some(({ assistantIds: assigned }) => assigned.some((id) => !activeIds.has(id))) ||
          scope.body.students.some(({ groupId }) => groupId !== null && !groupIds.has(groupId))) return unavailable;
        // DEMO-POP-4: the course's directory lists only assistants already on it; the candidates are the
        // institution's other confirmed teachers, so the holder can add one to the team.
        const candidates = await api("institution.teaching-team-candidates.get", { params, query: undefined, body: undefined });
        if (!candidates.ok) return failure(candidates.status);
        const assistants = [...scope.body.assistants, ...candidates.body.candidates.filter(({ id }) => !directoryIds.has(id))];
        return { kind: "ready", view: { ...scope.body, assistants, assistantIds } };
      } catch {
        return unavailable;
      }
    },
    async saveAssistants(assistantIds: string[]): Promise<Saved> {
      try {
        const result = await api("institution.teaching-team.post", { params, query: undefined, body: { assistantIds } });
        return result.ok ? { kind: "saved" } : failure(result.status);
      } catch {
        return unavailable;
      }
    },
    /** institution.course-groups.post: the holder or a collaborator adds a seminar group; one attempt, no retry. */
    async createGroup(rawName: string): Promise<Saved> {
      const name = groupName(rawName);
      if (name === null || !UUID.test(courseId)) return invalid;
      try {
        const result = await api("institution.course-groups.post", { params: { courseId }, query: undefined, body: { name } });
        return result.ok ? { kind: "saved" } : failure(result.status);
      } catch {
        return unavailable;
      }
    },
    /** institution.course-group-teachers.post: the holder puts a confirmed teacher into a group. `assigned: false` proves nothing. */
    async assignGroupTeacher(groupId: string, teacherId: string): Promise<Saved> {
      if (!UUID.test(groupId) || !UUID.test(teacherId)) return invalid;
      try {
        const result = await api("institution.course-group-teachers.post", { params: { groupId }, query: undefined, body: { teacherId } });
        if (!result.ok) return failure(result.status);
        return result.body.assigned ? { kind: "saved" } : unavailable;
      } catch {
        return unavailable;
      }
    },
    async saveGroup(groupId: string, assistantIds: string[], studentIds: string[]): Promise<Saved> {
      try {
        const result = await api("institution.teaching-group-members.put", {
          params: { ...params, groupId }, query: undefined, body: { assistantIds, studentIds },
        });
        return result.ok ? { kind: "saved" } : failure(result.status);
      } catch {
        return unavailable;
      }
    },
  };
}

export type TeachingTeamPort = ReturnType<typeof createTeachingTeam>;
