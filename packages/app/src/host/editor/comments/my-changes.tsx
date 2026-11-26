"use client";

// ED-42 (paritet P2-13, D51/D69): „Što sam promijenio/la” for the student, from the "Više" menu of the
// Comments card. It reads the existing route work.changes-since-review.get (the same one the
// teacher's card reads) and lists the blocks exactly as the server gives them, in its order: nothing
// is guessed on the client. A refused or failed read says so and offers to try again.
import { useEffect, useState } from "react";
import { Button, Tag } from "@ductura/ui";

import { createApi } from "../../../../../../src/client/api.ts";

import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";

export type MyChangeBlock = { readonly kind: string; readonly text: string; readonly change: "unchanged" | "removed" | "added" };
export type MyChangesSnapshot = {
  readonly reviewedRevision: number | null;
  readonly currentRevision: number;
  readonly changed: boolean;
  readonly blocks: readonly MyChangeBlock[];
};
export type MyChangesRead =
  | { readonly kind: "ready"; readonly snapshot: MyChangesSnapshot }
  | { readonly kind: "signedOut" | "unavailable" };
export type ReadMyChanges = (workId: string) => Promise<MyChangesRead>;

type Call = ReturnType<typeof createApi>;

/** The real read over the generated client; a throw or a refusal is never shown as "no changes". */
export async function readMyChanges(workId: string, call: Call = createApi()): Promise<MyChangesRead> {
  try {
    const answer = await call("work.changes-since-review.get", { params: { documentId: workId }, query: undefined, body: undefined });
    if (answer.ok) return { kind: "ready", snapshot: answer.body };
    return { kind: answer.status === 401 ? "signedOut" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The line above the list: since which reviewed version, or that no review exists yet. */
export function sinceLine(s: MyChangesSnapshot): string {
  return s.reviewedRevision === null ? t.myChangesNoReview(s.currentRevision) : t.myChangesSince(s.reviewedRevision, s.currentRevision);
}

/** Only the blocks that changed are listed; the unchanged ones are counted, not repeated. */
export function changedBlocks(s: MyChangesSnapshot): { readonly shown: readonly (MyChangeBlock & { key: string })[]; readonly unchanged: number } {
  const shown = s.blocks.map((b, i) => ({ ...b, key: String(i) })).filter((b) => b.change !== "unchanged");
  return { shown, unchanged: s.blocks.length - shown.length };
}

export function MyChanges({ workId, read }: { workId: string; read: ReadMyChanges }) {
  const [state, setState] = useState<MyChangesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null);
    void read(workId)
      .then((answer) => { if (active) setState(answer); })
      .catch(() => { if (active) setState({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [workId, read, attempt]);

  if (state === null) return <p role="status" className={styles.muted}>{t.myChangesLoading}</p>;
  if (state.kind !== "ready") {
    return (
      <>
        <p role="alert" className={styles.error}>{state.kind === "signedOut" ? t.signedOut : t.myChangesUnavailable}</p>
        {state.kind === "unavailable" && <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.myChangesRetry}</Button>}
      </>
    );
  }
  const { shown, unchanged } = changedBlocks(state.snapshot);
  return (
    <>
      <p className={styles.muted}>{sinceLine(state.snapshot)}</p>
      {!state.snapshot.changed || shown.length === 0 ? <p>{t.myChangesNone}</p> : (
        <ol className={styles.list} aria-label={t.myChanges}>
          {shown.map((b) => (
            <li key={b.key} data-change={b.change} className={styles.printItem}>
              <Tag tone="accent">{b.change === "added" ? t.myChangesAdded : t.myChangesRemoved}</Tag>{" "}
              {b.change === "removed" ? <del>{b.text}</del> : <ins>{b.text}</ins>}
            </li>
          ))}
        </ol>
      )}
      {unchanged > 0 && <p className={styles.muted}>{t.myChangesUnchanged(unchanged)}</p>}
    </>
  );
}
