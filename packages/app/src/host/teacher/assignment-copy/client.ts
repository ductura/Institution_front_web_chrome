import { createApi } from "@/client/api";
import { readTeacherCourses } from "@/components/teacher/teacher-courses-read";

export function readCopyCourses() {
  return readTeacherCourses(createApi());
}

export type CopyResult =
  | { kind: "copied"; id: string }
  | { kind: "signedOut" | "forbidden" | "missing" | "invalid" | "conflict" | "unconfirmed" };

export async function copyAssignment(
  assignmentId: string, courseId: string, requestKey: string, api = createApi(),
): Promise<CopyResult> {
  const result = await api("teacher.assignment-copy.post", {
    params: { assignmentId },
    query: undefined,
    body: { courseId, requestKey },
  }).catch(() => null);

  if (result?.ok) return { kind: "copied", id: result.body.id };
  switch (result?.code) {
    case "unauthorized":
    case "session_expired": return { kind: "signedOut" };
    case "origin_missing":
    case "origin_mismatch":
    case "cross_site": return { kind: "forbidden" };
    case "not_found": return { kind: "missing" };
    case "invalid_input":
    case "client_rejected": return { kind: "invalid" };
    case "conflict": return { kind: "conflict" };
    default: return { kind: "unconfirmed" };
  }
}
