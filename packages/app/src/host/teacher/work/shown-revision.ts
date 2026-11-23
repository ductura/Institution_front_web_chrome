// INT-15-WEB: the revision of the work the teacher's view shows, so that a new
// comment names it (collaboration.comments.post create, API 1.97.0) and its
// thread can read "uz verziju V{n}".
//
// The live route sends bytes, not a revision number, so the number comes from
// work.versions.get (newest first, the submission before the checkpoint of its
// revision):
// - the view shows the submitted text: the newest submission;
// - before any submission the view shows the student's last published state:
//   the newest saved version, which the server takes as a revision the
//   teacher may read (up to the current one).
// `current()` is asked before each request: once the session has ended
// nothing is sent (F-093).
import { useEffect, useRef, useState } from "react";

import { readTimeMachineVersions, type TimeMachineVersion, type VersionsResult } from "../../../../../../src/client/time-machine";

/** The revision on screen from one page of versions; null when none can be named. */
export function shownRevision(versions: readonly TimeMachineVersion[], submitted: boolean): number | null {
  const shown = submitted ? versions.find((version) => version.kind === "submission") : versions[0];
  return shown?.revision ?? null;
}

export type VersionsRead = (documentId: string) => Promise<VersionsResult>;

/**
 * Reads the shown revision again whenever the text on screen changes (`hash`).
 * Until the new answer comes the last one stands, which is never newer than the
 * text on screen; a change of work or from the live to the submitted text drops
 * it. Null while unknown, so no comment is sent with a guessed revision.
 */
export function useShownRevision(
  documentId: string, hash: string | null, submitted: boolean, current: () => boolean, enabled: boolean,
  read: VersionsRead = readTimeMachineVersions,
): number | null {
  const [shown, setShown] = useState<{ key: string; revision: number | null } | null>(null);
  const key = `${submitted ? "submitted" : "live"}:${documentId}`;
  // Asked at the time of the request and of the answer, never a reason to read again.
  const calls = useRef({ current, read });
  calls.current = { current, read };
  useEffect(() => {
    const { current: alive, read: versions } = calls.current;
    if (!enabled || hash === null || !alive()) return;
    let live = true;
    void versions(documentId).then((result) => {
      if (!live || !calls.current.current()) return;
      // A failed read keeps the last revision of the same text kind; a new kind starts unknown.
      setShown((last) => result.kind === "ready" ? { key, revision: shownRevision(result.versions, submitted) }
        : last?.key === key ? last : { key, revision: null });
    });
    return () => { live = false; };
  }, [documentId, hash, submitted, enabled, key]);
  return enabled && shown?.key === key ? shown.revision : null;
}
