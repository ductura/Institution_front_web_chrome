import { createApi } from "./api";
import { NOTICE_TEMPLATE_VERSION } from "../components/student/obavijest/notice-fingerprint";
import type { NoticeView } from "../components/student/assignment-notice-read";

export type StudentNoticeRead =
  | { kind: "available"; view: NoticeView; readAt: string | null }
  | { kind: "signedOut" | "notFound" | "unavailable" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInstant(value: string | null): boolean {
  if (value === null) return true;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}

export async function readStudentNotice(
  assignmentId: string, api = createApi(),
): Promise<StudentNoticeRead> {
  if (!UUID.test(assignmentId)) return { kind: "notFound" };
  try {
    const result = await api("student.notice.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) {
      if (result.status === 401) return { kind: "signedOut" };
      if (result.status === 404 || result.status === 403) return { kind: "notFound" };
      return { kind: "unavailable" };
    }

    const { readAt, templateVersion, ...view } = result.body;
    // The acknowledgment's fingerprint binds the displayed template and these fields.
    if (view.assignmentId !== assignmentId.toLowerCase() || templateVersion !== NOTICE_TEMPLATE_VERSION ||
        ![view.opensAt, view.dueAt, readAt, view.acknowledgedAt].every(isInstant) ||
        (view.aiPolicy === "prohibited" && view.aiPurposes.length !== 0)) {
      return { kind: "unavailable" };
    }
    return { kind: "available", view, readAt };
  } catch {
    return { kind: "unavailable" };
  }
}
