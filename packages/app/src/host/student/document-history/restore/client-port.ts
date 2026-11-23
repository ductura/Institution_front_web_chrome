// The real port of "Vrati raniju verziju" (PIL-D7-OBNOVA; plan P-D7). It writes nothing itself: the
// chosen version's text goes into the open editor as one change, and the editor's own save path (journal,
// drain, evidence.commit.post with a signed receipt) makes it a NEW revision. No earlier revision is
// touched. The only routes it reads are the two version reads of src/client/time-machine.ts, to know the
// head and the text; the fake port stays for the tests.
import {
  readTimeMachineVersion, readTimeMachineVersions,
} from "../../../../../../../src/client/time-machine.ts";
import { createApi } from "../../../../../../../src/client/api.ts";
import { validateDocument, type CanonicalDocument } from "@/domain/document";
import type { RestorePort } from "./model";

type Call = ReturnType<typeof createApi>;

/** What the port needs of the open editor; the page builds it from LocalDocument (restore-editor.ts). */
export type RestoreEditor = {
  /** The session of this tab has ended (D-118). */
  signedOut(): boolean;
  /** The sheet takes text now: loaded, held by this tab, not submitted, not in a sticky state. */
  writable(): boolean;
  /** The sheet may hold text the server has not confirmed, read at the moment of the call (DAN-314). */
  unconfirmed(): boolean;
  /** Changes the editor has reported in this tab; a change typed and confirmed during the reads moves it. */
  edits(): number;
  /** Puts the document into the sheet as one change of the author; false when the editor refused it. */
  apply(document: CanonicalDocument): boolean;
  /** Waits for the server's verified receipt of every change in the sheet, or says why it did not come. */
  confirmed(): Promise<"confirmed" | "signedOut" | "waiting">;
};

const head = (versions: readonly { revision: number }[]): number => versions.reduce((max, v) => Math.max(max, v.revision), 0);

/** The stored text of a version as the editor's canonical document, or null when it is not one. */
export function restorableDocument(text: string): CanonicalDocument | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  const checked = validateDocument(parsed);
  return checked.ok ? checked.doc : null;
}

export function clientRestorePort(editor: RestoreEditor, call: Call = createApi()): RestorePort {
  let running = false;
  const restore: RestorePort["restore"] = async (documentId, fromRevision, baseRevision) => {
    if (editor.signedOut()) return { kind: "signedOut" };
    // Text typed and not yet confirmed is newer than any listed version: never overwritten.
    if (editor.unconfirmed()) return { kind: "stale", currentRevision: baseRevision };
    const edits = editor.edits();
    const listed = await readTimeMachineVersions(documentId, call);
    if (listed.kind !== "ready") return { kind: listed.kind };
    const current = head(listed.versions);
    if (current !== baseRevision) return { kind: "stale", currentRevision: current };
    const read = await readTimeMachineVersion(documentId, fromRevision, call);
    if (read.kind === "signedOut") return { kind: "signedOut" };
    if (read.kind !== "ready") return { kind: "unavailable" };
    const document = restorableDocument(read.document);
    if (document === null) return { kind: "unavailable" };
    // Everything may have changed during the two reads, a change typed and already confirmed included.
    if (editor.signedOut()) return { kind: "signedOut" };
    if (editor.unconfirmed() || editor.edits() !== edits) return { kind: "stale", currentRevision: baseRevision };
    if (!editor.writable() || !editor.apply(document)) return { kind: "unavailable" };
    const confirmed = await editor.confirmed();
    // The text is in the sheet and in the journal: a sign-out keeps it for the next sign-in (D-118).
    if (confirmed === "signedOut") return { kind: "signedOut" };
    return confirmed === "confirmed" ? { kind: "saved" } : { kind: "pending" };
  };
  return {
    // A pending restore's receipt is the editor's: nothing in the sheet is unconfirmed any more.
    receipt: () => editor.confirmed(),
    // One restore at a time: a second click while the first runs changes nothing.
    async restore(documentId, fromRevision, baseRevision) {
      if (running) return { kind: "unavailable" };
      running = true;
      try {
        return await restore(documentId, fromRevision, baseRevision);
      } finally {
        running = false;
      }
    },
  };
}
