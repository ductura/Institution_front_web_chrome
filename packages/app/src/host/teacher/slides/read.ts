// WEB-V13-NASTAVNIK-PREGLED: the teacher's reads of a work's slides, only through the generated client:
// work.versions.get (which revisions exist) and work.version.get (one revision's canonical document and its
// `documentKind`). Nothing is written. A work that somebody else owns is 404 on the server and "notFound" here.
import { createApi } from "../../../../../../src/client/api.ts";
import { parseRevisionDocument, type ReadRevision } from "./model.ts";

type Call = ReturnType<typeof createApi>;

export type Revision = { readonly revision: number; readonly kind: "checkpoint" | "submission"; readonly savedMinute: string };

export type SlidesRevisions =
  | { readonly kind: "slides"; readonly revisions: readonly Revision[]; readonly more: boolean }
  | { readonly kind: "text" }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type RevisionRead = ReadRevision | { readonly kind: "signedOut" | "notFound" | "unavailable" };

/**
 * Which kind of work this is and which revisions it has. The kind comes from the newest saved revision
 * (`documentKind` of work.version.get); an answer without it, a work without a saved revision and a text work
 * are all "text" (the text page then shows its own state).
 */
export async function readSlidesRevisions(documentId: string, call: Call = createApi()): Promise<SlidesRevisions> {
  try {
    const list = await call("work.versions.get", { params: { documentId }, query: {}, body: undefined });
    if (!list.ok) return { kind: list.status === 401 ? "signedOut" : list.status === 404 ? "notFound" : "unavailable" };
    const revisions = list.body.versions.map(({ revision, kind, savedMinute }): Revision => ({ revision, kind, savedMinute }))
      .sort((a, b) => b.revision - a.revision);
    const newest = revisions[0];
    if (newest === undefined) return { kind: "text" };
    const one = await call("work.version.get", { params: { documentId, revision: String(newest.revision) }, query: {}, body: undefined });
    if (!one.ok) return { kind: one.status === 401 ? "signedOut" : one.status === 404 ? "notFound" : "unavailable" };
    if (!("document" in one.body) || one.body.documentKind !== "slides") return { kind: "text" };
    return { kind: "slides", revisions, more: list.body.nextBeforeRevision !== null };
  } catch {
    return { kind: "unavailable" };
  }
}

/** One revision's slides, shown only when the bytes are the exact canonical document of a slides work. */
export async function readSlidesRevision(documentId: string, revision: number, call: Call = createApi()): Promise<RevisionRead> {
  if (!Number.isSafeInteger(revision) || revision < 1) return { kind: "unavailable" };
  try {
    const one = await call("work.version.get", { params: { documentId, revision: String(revision) }, query: {}, body: undefined });
    if (!one.ok) return { kind: one.status === 401 ? "signedOut" : one.status === 404 ? "notFound" : "unavailable" };
    if (!("document" in one.body) || one.body.revision !== revision) return { kind: "unavailable" };
    if (one.body.documentKind !== "slides") return { kind: "invalid" };
    return await parseRevisionDocument(revision, one.body.document);
  } catch {
    return { kind: "unavailable" };
  }
}
