import { createApi, type Input } from "@/client/api";
import { messagesHr } from "@/lib/i18n/messages.hr";

import type { AssignmentBody, AssignmentCreation } from "../assignment-create";
import type { VersionBody, VersionPublish } from "../assignment-version";

type MutationFailure = Exclude<AssignmentCreation["kind"], "available">;
type Failure = { status: number; code: string };

function failure({ status, code }: Failure): MutationFailure {
  if (code === "client_rejected" || [400, 413, 415, 422].includes(status)) return "invalid";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "unavailable";
}

export async function publishAssignment(
  courseId: string, body: AssignmentBody, requestKey: string, api = createApi(),
): Promise<AssignmentCreation> {
  try {
    const result = await api("institution.course-assignments.post", {
      params: { courseId }, query: undefined, body: { ...body, requestKey },
    });
    return result.ok ? { kind: "available", id: result.body.id } : { kind: failure(result) };
  } catch {
    return { kind: "unavailable" };
  }
}

type VersionInput = Input<"institution.assignment-versions.post">["body"];
const workTypes: readonly string[] = Object.keys(messagesHr.teacher.assignment.workTypes);
const policies: readonly string[] = Object.keys(messagesHr.teacher.course.policies);

export async function publishAssignmentVersion(
  assignmentId: string, body: VersionBody, api = createApi(),
): Promise<VersionPublish> {
  if (!workTypes.includes(body.workType) || !policies.includes(body.aiPolicy)) return { kind: "invalid" };
  try {
    const result = await api("institution.assignment-versions.post", {
      params: { assignmentId }, query: undefined,
      body: { ...body, workType: body.workType as VersionInput["workType"], aiPolicy: body.aiPolicy as VersionInput["aiPolicy"] },
    });
    if (!result.ok) return { kind: failure(result) };
    if (result.body.assignmentId.toLowerCase() !== assignmentId.toLowerCase() ||
        result.body.versionNo !== body.expectedVersion + 1) return { kind: "unavailable" };
    return { kind: "published", versionNo: result.body.versionNo };
  } catch {
    return { kind: "unavailable" };
  }
}
