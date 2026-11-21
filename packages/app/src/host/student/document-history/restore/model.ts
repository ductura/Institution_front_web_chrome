// Pure rules of "restore an earlier version of my own text" (WEB-1907; plan P-D7). Restoring is a
// NEW signed revision written through the save path the editor already uses (the port wraps it);
// no earlier revision is ever removed or changed, so the replay (wave 9) stays exact and shows the
// restore as its own step. No network call is made here; the port is built on src/client.
import type { Version } from "../../time-machine/model";

export type RestoreOutcome =
  | { readonly kind: "saved"; readonly revision: number }
  | { readonly kind: "stale"; readonly currentRevision: number }
  | { readonly kind: "signedOut" | "unavailable" };

export interface RestorePort {
  /** Saves the text of `fromRevision` as a new revision on top of `baseRevision` (the save path). */
  restore(documentId: string, fromRevision: number, baseRevision: number): Promise<RestoreOutcome>;
}

export type RestoreRecord = { readonly fromRevision: number; readonly newRevision: number; readonly minute: string };

/** The newest revision of the list, or 0 when there is none. */
export function headRevision(versions: readonly Version[]): number {
  return versions.reduce((max, v) => Math.max(max, v.revision), 0);
}

/** Only earlier revisions can be restored, newest first; the head is already the current text. */
export function restorableVersions(versions: readonly Version[]): readonly Version[] {
  const head = headRevision(versions);
  const byRevision = new Map(versions.filter((v) => v.revision < head).map((v) => [v.revision, v]));
  return [...byRevision.values()].sort((a, b) => b.revision - a.revision);
}

/** Restores through the port. A saved answer must be a revision strictly above the base, else it is unavailable. */
export async function restoreVersion(
  port: RestorePort, documentId: string, versions: readonly Version[], fromRevision: number,
): Promise<RestoreOutcome> {
  if (!restorableVersions(versions).some((v) => v.revision === fromRevision)) return { kind: "unavailable" };
  const base = headRevision(versions);
  try {
    const outcome = await port.restore(documentId, fromRevision, base);
    if (outcome.kind === "saved" && !(Number.isSafeInteger(outcome.revision) && outcome.revision > base)) return { kind: "unavailable" };
    return outcome;
  } catch {
    return { kind: "unavailable" };
  }
}

/** History after a restore: every earlier version stays, the restore is one new checkpoint on top. */
export function versionsAfterRestore(versions: readonly Version[], record: RestoreRecord): readonly Version[] {
  if (record.newRevision <= headRevision(versions)) return versions;
  return [...versions, { kind: "checkpoint", revision: record.newRevision, savedMinute: record.minute }];
}

/** The slice of a replay change this module needs (src/client/replay-record ReplayChange). */
export type ReplayChangeLike = { readonly index: number; readonly kind: string };

export type ReplayItem =
  | { readonly type: "change"; readonly change: ReplayChangeLike }
  | { readonly type: "restore"; readonly index: number; readonly fromRevision: number };

/**
 * The replay shows a restore as its own step: the change at `restoreAtIndex` is the segment that
 * carried the restore, so it becomes one "restore" item instead of an ordinary edit. All other
 * changes are kept, in order, and nothing is dropped.
 */
export function replayItems(
  changes: readonly ReplayChangeLike[], restoreAtIndex: Readonly<Record<number, number>>,
): readonly ReplayItem[] {
  return changes.map((change): ReplayItem => {
    const from = restoreAtIndex[change.index];
    return from === undefined ? { type: "change", change } : { type: "restore", index: change.index, fromRevision: from };
  });
}
