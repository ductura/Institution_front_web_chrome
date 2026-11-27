/**
 * F4-NAS-R20-RUTA: the teacher's read of the revision a student submitted, through the teacher route
 * `teacher.work.submitted-version.get` (course_teacher; not the owner route `work.version.get`). The route answers
 * 404 for a work the caller may not read, a revision that is not the live submission and a withdrawn one, so
 * "notFound" here covers all of them. The document is shown only when its bytes are the exact canonical
 * document of a known version; anything else is "unavailable", never shown in part.
 */
import { createApi } from "@/client/api";
import { verifyVersionedDocumentSnapshot } from "../../../../../editor-core/src/document/document/snapshot";
import type { ElementsRead } from "../text-elements/reader";

type Call = ReturnType<typeof createApi>;

export async function readSubmittedVersion(documentId: string, revision: number, call: Call = createApi()): Promise<ElementsRead> {
  if (!Number.isSafeInteger(revision) || revision < 1) return { kind: "unavailable" };
  try {
    const one = await call("teacher.work.submitted-version.get", { params: { documentId, revision: String(revision) }, query: undefined, body: undefined });
    if (!one.ok) return { kind: one.status === 401 ? "signedOut" : one.status === 404 ? "notFound" : "unavailable" };
    if (one.body.revision !== revision) return { kind: "unavailable" };
    const snapshot = await verifyVersionedDocumentSnapshot(new TextEncoder().encode(one.body.document));
    return snapshot.ok ? { kind: "document", document: snapshot.document } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
