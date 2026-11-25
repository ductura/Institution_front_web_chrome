"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, DiffView } from "@ductura/ui";

import { diffParts, type CompareRead, type Version } from "../../time-machine/model";
import { headRevision, restorableVersions, restoreVersion, type RestoreOutcome, type RestorePort } from "./model";
import { restoreMessages as text } from "./messages.hr";
import { paragraphs, readRestoreDiff, type DiffRead } from "./restore-diff";

const onLine = (change: () => void) => {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => { window.removeEventListener("online", change); window.removeEventListener("offline", change); };
};
/** Without a network the restore cannot reach the server, so "Da, vrati" waits for it (NF2-P15). */
const useOnline = () => useSyncExternalStore(onLine, () => navigator.onLine !== false, () => true);

/** "Vrati raniju verziju" (WEB-1907; P-D7): pick an earlier version, confirm, save it as a new revision. */
export default function RestoreVersion({
  documentId, versions, port, compare, onRestored, onRecorded, onStale,
}: {
  documentId: string; versions: readonly Version[]; port: RestorePort; onRestored?: () => void;
  /** ED-17: the history's comparison (`work.compare.get`), for the preview before "Da, vrati". */
  compare?: (from: number, to: number) => Promise<CompareRead>;
  /** A restore is in the sheet, confirmed or waiting for the receipt; the caller keeps its label (INT-21). */
  onRecorded?: (fromRevision: number, confirmed: boolean) => void;
  /** The list is older than the server's head: the caller reads it again (PIL-D7-OBNOVA). */
  onStale?: () => void;
}) {
  const [picked, setPicked] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // `busy` is the last render's: a second click before the next render still sees false. The ref
  // holds the restore from its first click, so a second one never reaches the port, whose refusal
  // would clear `busy` while the first restore still runs.
  const running = useRef(false);
  const [result, setResult] = useState<RestoreOutcome | null>(null);
  const [from, setFrom] = useState(0);
  const options = restorableVersions(versions);
  const online = useOnline();
  const [diff, setDiff] = useState<DiffRead | null>(null);
  const head = headRevision(versions);

  // The preview is read when the step opens, for the version picked then; a later answer for an
  // earlier pick is dropped.
  useEffect(() => {
    if (!confirming || compare === undefined || picked === "") { setDiff(null); return undefined; }
    let live = true;
    setDiff({ kind: "loading" });
    void readRestoreDiff(compare, Number(picked), head).then((read) => { if (live) setDiff(read); });
    return () => { live = false; };
  }, [confirming, compare, picked, head]);
  const chosen = options.find((v) => String(v.revision) === picked);

  const run = async () => {
    if (running.current || !online) return;
    running.current = true;
    const revision = Number(picked);
    setBusy(true);
    setConfirming(false);
    const outcome = await restoreVersion(port, documentId, versions, revision);
    running.current = false;
    setBusy(false);
    setResult(outcome);
    setFrom(revision);
    if (outcome.kind === "saved" || outcome.kind === "pending") {
      setPicked("");
      onRecorded?.(revision, outcome.kind === "saved");
    }
    if (outcome.kind === "saved") onRestored?.();
    if (outcome.kind === "stale") onStale?.();
  };

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {options.length === 0 ? <p>{text.nothing}</p> : (
        <>
          <p>{text.intro}</p>
          <label>
            {text.chooseLabel}
            <select value={picked} disabled={busy} onChange={(e) => { setPicked(e.target.value); setConfirming(false); setResult(null); }}>
              <option value="">{text.choose}</option>
              {options.map((v) => <option key={v.revision} value={String(v.revision)}>{text.version(v.revision, v.savedMinute)}</option>)}
            </select>
          </label>
          <Button disabled={picked === "" || busy} onClick={() => setConfirming(true)}>{text.action}</Button>
          {confirming ? (
            <div role="alertdialog" aria-labelledby="vrati-naslov">
              <h3 id="vrati-naslov">{text.confirmTitle}</h3>
              {chosen ? <p><b>{text.version(chosen.revision, chosen.savedMinute)}</b></p> : null}
              <p>{text.confirmBody}</p>
              {diff === null ? null : (
                <section aria-label={text.diffTitle} data-restore-diff={diff.kind}>
                  <h4>{text.diffTitle}</h4>
                  {diff.kind === "loading" ? <p role="status">{text.diffLoading}</p> : null}
                  {diff.kind === "unavailable" ? <p>{text.diffUnavailable}</p> : null}
                  {diff.kind === "ready" && diff.diff.first.length === 0 ? <p>{text.diffNone}</p> : null}
                  {diff.kind === "ready" && diff.diff.first.length > 0 ? (
                    <>
                      <p>{text.diffCount(paragraphs(diff.diff.added), paragraphs(diff.diff.removed))}</p>
                      <DiffView parts={diffParts(diff.diff.first)} />
                    </>
                  ) : null}
                </section>
              )}
              <p>{text.newVersionNote}</p>
              {online ? null : <p role="status">{text.offline}</p>}
              <Button onClick={() => setConfirming(false)}>{text.cancel}</Button>
              <Button disabled={busy || !online} onClick={() => void run()}>{text.confirm}</Button>
            </div>
          ) : null}
        </>
      )}
      <div aria-live="polite">
        {busy ? <p role="status">{text.restoring}</p> : null}
        {result?.kind === "saved" ? <p role="status">{text.done(from)}</p> : null}
        {result?.kind === "stale" ? <p role="alert">{text.stale}</p> : null}
        {result?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
        {/* "pending" is announced by RestoreHost, which also says when the receipt comes (INT-21). */}
        {result?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p><Button disabled={busy || !online} onClick={() => void run()}>{text.retry}</Button></> : null}
      </div>
    </section>
  );
}
