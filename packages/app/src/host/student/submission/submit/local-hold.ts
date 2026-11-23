// INT-16: the browser's side of the check in newer-local.ts. The device's journal is read (never
// written) under the person's scope, within the same limit as the sign-out's read; a scope, a store
// or a read that is missing says "no newer version", so the warning never holds a submission back.
import { withinHoldLimit } from "../../../../../../../src/client/logout-hold";
import { readJournalScope } from "../../../../../../../src/components/editor/EditorPage.scope";
import { readWork } from "../../../../../../../src/components/student/Submission";
import { AtomicDexieJournal } from "../../../../../../../packages/editor-core/src/journal/atomic-dexie-journal";
import { waitForLatest, type Confirmed } from "./newer-local";

/** How long "Pošalji najprije zadnju verziju" waits for the server to confirm it, and how often it looks. */
export const LATEST_LIMIT_MS = 20_000;
export const LATEST_EVERY_MS = 1_000;

/** Whether this device holds text of the document the server has not confirmed (DAN-699). */
export async function deviceHasNewer(documentId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined" || !indexedDB) return false;
  const read = await readJournalScope().catch(() => null);
  if (read === null || read.kind !== "scope") return false;
  return withinHoldLimit(() => AtomicDexieJournal.peekDocumentHold(read.scope, documentId), false);
}

/** The revision the server confirmed for the newest version, or null once the limit has passed. */
export function sendLatestFromDevice(assignmentId: string, confirmed: Confirmed): Promise<Confirmed | null> {
  return waitForLatest(confirmed, {
    hasNewer: deviceHasNewer,
    readConfirmed: async () => {
      const work = await readWork(assignmentId);
      return work.kind === "ready" ? { documentId: work.documentId, revision: work.revision } : null;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    limitMs: LATEST_LIMIT_MS,
    everyMs: LATEST_EVERY_MS,
  });
}
