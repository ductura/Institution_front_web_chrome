"use client";

import { useRef, useState } from "react";
import { Button } from "@ductura/ui";

import type { Version } from "../../time-machine/model";
import { restorableVersions, restoreVersion, type RestoreOutcome, type RestorePort } from "./model";
import { restoreMessages as text } from "./messages.hr";

/** "Vrati raniju verziju" (WEB-1907; P-D7): pick an earlier version, confirm, save it as a new revision. */
export default function RestoreVersion({
  documentId, versions, port, onRestored, onRecorded, onStale,
}: {
  documentId: string; versions: readonly Version[]; port: RestorePort; onRestored?: (fromRevision: number) => void;
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

  const run = async () => {
    if (running.current) return;
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
    if (outcome.kind === "saved") onRestored?.(revision);
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
            <div role="alertdialog" aria-label={text.confirmTitle}>
              <p>{text.confirmBody}</p>
              <Button disabled={busy} onClick={() => void run()}>{text.confirm}</Button>
              <Button onClick={() => setConfirming(false)}>{text.cancel}</Button>
            </div>
          ) : null}
        </>
      )}
      <div aria-live="polite">
        {busy ? <p role="status">{text.restoring}</p> : null}
        {result?.kind === "saved" ? <p role="status">{text.done(from)}</p> : null}
        {result?.kind === "stale" ? <p role="alert">{text.stale}</p> : null}
        {result?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
        {result?.kind === "pending" ? <p role="status">{text.pending}</p> : null}
        {result?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p><Button disabled={busy} onClick={() => void run()}>{text.retry}</Button></> : null}
      </div>
    </section>
  );
}
