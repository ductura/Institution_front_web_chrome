import { createApi, type ApiOptions } from "./api";
import type { SessionMark } from "./session-marks";
import type { SubmissionState } from "./submission";
import { readTeacherReceipt, type WorkState } from "./teacher-reads";

type AccessRead =
  | { kind: "ready"; value: SessionMark }
  | { kind: "notTeacher" | "signedOut" | "unavailable" };

export async function readTeacherWorkAccess(options?: ApiOptions): Promise<AccessRead> {
  const at = Date.now();
  try {
    const api = createApi(options);
    const access = await api("teacher.access.get", { params: undefined, query: undefined, body: undefined });
    if (!access.ok) {
      if (access.status === 401) return { kind: "signedOut" };
      return { kind: access.status === 403 ? "notTeacher" : "unavailable" };
    }
    if (access.body.access !== "allowed") return { kind: "notTeacher" };

    const me = await api("profile.me.get", { params: undefined, query: undefined, body: undefined });
    if (!me.ok) return { kind: me.status === 401 ? "signedOut" : "unavailable" };
    if (!me.body.roles.includes("teacher")) return { kind: "notTeacher" };
    return { kind: "ready", value: { tag: me.body.sessionTag, at } };
  } catch {
    return { kind: "unavailable" };
  }
}

type TeacherReceiptRead =
  | { kind: "ready"; state: WorkState; studentName: string | null; submission: SubmissionState }
  | { kind: "signedOut" | "notFound" | "unavailable" };

export async function readTeacherWorkReceipt(
  documentId: string, current: () => boolean, options?: ApiOptions,
): Promise<TeacherReceiptRead> {
  if (!current()) return { kind: "signedOut" };
  try {
    const api = createApi(options);
    // TODO(ugovor): the document lookup agreed in Ductus#2028 c.7024185874.
    const work = await api("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    if (!current() || work.status === 401) return { kind: "signedOut" };
    if (!work.ok) return { kind: work.status === 404 ? "notFound" : "unavailable" };
    if (work.body.documentId !== documentId) return { kind: "unavailable" };

    const { assignmentId, studentId, studentName, state } = work.body;
    const submission = await readTeacherReceipt(
      () => api("teacher.submission-receipt.get", {
        params: { assignmentId, studentId }, query: undefined, body: undefined,
      }),
      assignmentId, studentId,
    );
    if (!current() || submission.kind === "session-expired") return { kind: "signedOut" };
    if (submission.kind === "greska" && submission.code === "not_found") return { kind: "notFound" };
    if (submission.kind === "potvrdeno" && submission.receipt.payload.documentId !== documentId) {
      return { kind: "unavailable" };
    }
    if (submission.kind !== "none" && submission.kind !== "ceka" && submission.kind !== "potvrdeno") {
      return { kind: "unavailable" };
    }
    return { kind: "ready", studentName, state, submission };
  } catch {
    return { kind: "unavailable" };
  }
}
