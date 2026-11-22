"use client";

import { useState } from "react";
import { Button } from "@ductura/ui";

import type { Version } from "../../time-machine/model";
import { restorableVersions, restoreVersion, type RestoreOutcome, type RestorePort } from "./model";
import { restoreMessages as text } from "./messages.hr";

/** "Vrati raniju verziju" (WEB-1907; P-D7): pick an earlier version, confirm, save it as a new revision. */
export default function RestoreVersion({
  documentId, versions, port, onRestored, onStale,
}: {
  documentId: string; versions: readonly Version[]; port: RestorePort; onRestored?: (fromRevision: number, newRevision: number) => void;
  /** The list is older than the server's head: the caller reads it again (PIL-D7-OBNOVA). */
  onStale?: () => void;
}) {
  const [picked, setPicked] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreOutcome | null>(null);
  const [from, setFrom] = useState(0);
  // This page's restores, so each new revision carries "vraćeno iz verzije N" (PIL-D7-OBNOVA).
  const [restored, setRestored] = useState<readonly { from: number; to: number }[]>([]);
  const options = restorableVersions(versions);

  const run = async () => {
    const revision = Number(picked);
    setBusy(true);
    setConfirming(false);
    const outcome = await restoreVersion(port, documentId, versions, revision);
    setBusy(false);
    setResult(outcome);
    setFrom(revision);
    if (outcome.kind === "saved") {
      setPicked("");
      setRestored((list) => [...list, { from: revision, to: outcome.revision }]);
      onRestored?.(revision, outcome.revision);
    }
    if (outcome.kind === "pending") setPicked("");
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
            <select value={picked} onChange={(e) => { setPicked(e.target.value); setConfirming(false); setResult(null); }}>
              <option value="">{text.choose}</option>
              {options.map((v) => <option key={v.revision} value={String(v.revision)}>{text.version(v.revision, v.savedMinute)}</option>)}
            </select>
          </label>
          <Button disabled={picked === "" || busy} onClick={() => setConfirming(true)}>{text.action}</Button>
          {confirming ? (
            <div role="alertdialog" aria-label={text.confirmTitle}>
              <p>{text.confirmBody}</p>
              <Button onClick={() => void run()}>{text.confirm}</Button>
              <Button onClick={() => setConfirming(false)}>{text.cancel}</Button>
            </div>
          ) : null}
        </>
      )}
      <div aria-live="polite">
        {busy ? <p role="status">{text.restoring}</p> : null}
        {result?.kind === "saved" ? <p role="status">{text.done(from, result.revision)}</p> : null}
        {result?.kind === "stale" ? <p role="alert">{text.stale}</p> : null}
        {result?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
        {result?.kind === "pending" ? <p role="status">{text.pending}</p> : null}
        {result?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p><Button onClick={() => void run()}>{text.retry}</Button></> : null}
      </div>
      {restored.length > 0 ? (
        <ul aria-label={text.title}>
          {restored.map((r) => <li key={r.to} data-restored-from={r.from}>{text.restoredVersion(r.to, r.from)}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
