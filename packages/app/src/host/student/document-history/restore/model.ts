// Pure rules of restoring the student's own earlier text (WEB-1907; plan P-D7). Restoring never
// rewrites history: the text of an older revision goes through the editor's existing save path and
// becomes a new revision, signed like any other edit, so the replay shows it as its own step and
// every older revision stays. The port therefore has no way to delete or overwrite a revision.
// No network call is made here; the page that mounts this builds the port on the editor and
// src/client/time-machine.ts.

/** The editor's JSON of one revision, passed through untouched. */
export type RevisionDocument = unknown;

export type RevisionRead =
  | { readonly kind: "ready"; readonly document: RevisionDocument }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type SaveResult =
  | { readonly kind: "saved"; readonly revision: number }
  | { readonly kind: "conflict" | "signedOut" | "unavailable" };

export interface RestorePort {
  readRevision(documentId: string, revision: number): Promise<RevisionRead>;
  /** The existing save path: `document` becomes the revision after `baseRevision`, or a conflict. */
  saveAsNewRevision(documentId: string, document: RevisionDocument, baseRevision: number): Promise<SaveResult>;
}

export type RestoreRequest = { readonly documentId: string; readonly revision: number; readonly currentRevision: number };

export type RestoreOutcome =
  | { readonly kind: "done"; readonly from: number; readonly revision: number }
  | { readonly kind: "conflict" | "signedOut" | "notFound" | "unavailable" };

const whole = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;

/** Only an older revision can be restored; the current one already is the text. */
export function canRestore(revision: number, currentRevision: number): boolean {
  return whole(revision) && whole(currentRevision) && revision < currentRevision;
}

/**
 * Reads the older revision and saves its text as the next revision. A save that does not answer
 * with a revision after the current one is "unavailable", never taken as done.
 */
export async function restoreRevision(port: RestorePort, request: RestoreRequest): Promise<RestoreOutcome> {
  const { documentId, revision, currentRevision } = request;
  if (!canRestore(revision, currentRevision)) return { kind: "unavailable" };
  try {
    const read = await port.readRevision(documentId, revision);
    if (read.kind !== "ready") return { kind: read.kind };
    const saved = await port.saveAsNewRevision(documentId, read.document, currentRevision);
    if (saved.kind !== "saved") return { kind: saved.kind };
    if (!whole(saved.revision) || saved.revision <= currentRevision) return { kind: "unavailable" };
    return { kind: "done", from: revision, revision: saved.revision };
  } catch {
    return { kind: "unavailable" };
  }
}
