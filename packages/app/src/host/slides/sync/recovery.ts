// WEB-V13-DNEVNIK-SINKRONIZACIJA: the pure decisions of the slides session, in
// one place so they can be tested without a journal, a network or a page.
// Nothing here reads a clock or does I/O.
import type { SyncState } from "../../../../../editor-core/src/sync/states.ts";

/** The states the journal holds the author's text in until a decision is made. */
export const STICKY_STATES: ReadonlySet<SyncState> = new Set(["CONFLICT", "RECOVERY_REQUIRED"]);

export type SlidesSaveInput = {
  /** The journal's meta state as last read or written; null before the first read. */
  stored: SyncState | null;
  /** A save failed and none succeeded since. */
  failed: boolean;
  /** Changes not yet in the journal (inside the debounce, being saved). */
  unsaved: boolean;
  saving: boolean;
  /** A drain step is in flight for rows owed. */
  syncing: boolean;
  /** A receipt for the saved text passed the signature check in this page session. */
  receiptVerifiedHere: boolean;
  /** A submission closed the package: nothing is written or sent any more. */
  closedBySubmission: boolean;
};

/**
 * The state the status bar may claim. SYNCED only from the journal's own
 * state after a receipt verified in this page session (a reload starts at
 * LOCAL_DURABLE, "Spremljeno na uređaju"); SYNCING only while a step runs.
 */
export function shownSaveState(input: SlidesSaveInput): SyncState {
  if (input.stored !== null && STICKY_STATES.has(input.stored)) return input.stored;
  if (input.closedBySubmission) return "LOCAL_DURABLE";
  if (input.failed) return "ERROR";
  if (input.unsaved) return input.saving ? "SAVING_LOCAL" : "EDITING";
  if (input.stored === null) return "EDITING";
  if (input.syncing) return "SYNCING";
  // A SYNCING left in the journal outside a step of this page is a send that never ended.
  if (input.stored === "SYNCING") return "LOCAL_DURABLE";
  return input.stored === "SYNCED" && !input.receiptVerifiedHere ? "LOCAL_DURABLE" : input.stored;
}

/** What the page does with the end of a load. */
export type SlidesLoadResult<D> =
  | { kind: "ready"; document: D; readOnly: boolean }
  /** `sticky`: CONFLICT or RECOVERY_REQUIRED, the journal's text is shown and never written over. */
  | { kind: "recovery"; reason: "corrupt" | "sticky"; document: D | null }
  /** Not a slides work, or nowhere honest to save: the editor says so, it does not guess. */
  | { kind: "unavailable" };

/** Whether the document may be edited: not after a submission closed the package, not in recovery. */
export function isEditable(result: SlidesLoadResult<unknown>): boolean {
  return result.kind === "ready" && !result.readOnly;
}
