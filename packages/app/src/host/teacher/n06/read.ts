import { createApi, type ApiOptions } from "@/client/api";
import { readTeacherReceipt } from "@/client/teacher-reads";
import type { Facts } from "./model";

export type FrameRead = { kind: "ready"; facts: Facts } | { kind: "signedOut" | "notFound" | "unavailable" };

/** teacher.work.get plus, for a submitted work, its receipt. Never throws. */
export async function readFrame(documentId: string, options?: ApiOptions): Promise<FrameRead> {
  try {
    const call = createApi(options);
    const work = await call("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
    if (work.status === 401) return { kind: "signedOut" };
    if (!work.ok) return { kind: work.status === 404 ? "notFound" : "unavailable" };
    const b = work.body;
    if (b.documentId !== documentId) return { kind: "unavailable" };
    let receipt: Facts["receipt"] = null;
    if (b.state === "predano" || b.state === "nakon_roka") {
      const sub = await readTeacherReceipt(
        () => call("teacher.submission-receipt.get", { params: { assignmentId: b.assignmentId, studentId: b.studentId }, query: undefined, body: undefined }),
        b.assignmentId, b.studentId,
      );
      if (sub.kind === "potvrdeno" && sub.receipt.payload.documentId === documentId) {
        const p = sub.receipt.payload;
        receipt = { submittedAt: p.requestedAt, dueAt: p.dueAt, afterDeadline: p.afterDeadline, version: p.revision, record: p.evidenceRecord, sha256: p.artifactSha256 };
      }
    }
    return { kind: "ready", facts: {
      studentName: b.studentName, assignmentId: b.assignmentId, state: b.state,
      previousId: b.prevDocumentId, nextId: b.nextDocumentId, receipt,
    } };
  } catch {
    return { kind: "unavailable" };
  }
}
