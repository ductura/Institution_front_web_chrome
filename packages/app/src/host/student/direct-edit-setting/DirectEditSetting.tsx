"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@ductura/ui";
import { goToSignIn } from "@/client/api";

import {
  afterChange, changeDirectEdit, changeMessage, directEditBadge, type DirectEditPort, type DirectEditState, type SettingShown,
} from "./model";
import { directEditSettingMessages as text } from "./messages.hr";
import { directEditPort } from "./port";

/** One port for the page: the setting reads again only when the work changes, not on every render. */
const serverPort = directEditPort();

/** The setting as drawn: the mark, and the switch only while the work is not submitted. */
export function DirectEditView(
  { state, busy, note, submitted, onChange }:
  { state: DirectEditState; busy: boolean; note: string | null; submitted: boolean; onChange: (enabled: boolean) => void },
) {
  const { enabled } = state;
  const heading = useId();
  return (
    <section aria-labelledby={heading}>
      <h2 id={heading}>{text.title}</h2>
      <p>{text.description}</p>
      <p data-direct-edit-badge={enabled ? "on" : "off"}>{directEditBadge(enabled)}</p>
      {submitted
        ? <p>{text.submittedLocked}</p>
        : <Button disabled={busy} onClick={() => onChange(!enabled)}>{enabled ? text.revoke : text.enable}</Button>}
      <p role="status" aria-live="polite">{note}</p>
    </section>
  );
}

/**
 * The student's work settings: allow or revoke the teacher's direct edits (WEB-1703; M6.4).
 * The mark below the switch is the one the teacher sees too. After a submission the setting
 * is fixed and shown read-only. A change shows as done only after the server names it.
 */
export default function DirectEditSetting(
  { documentId, port, submitted = false, onSignedOut }:
  { documentId: string; port: DirectEditPort; submitted?: boolean; onSignedOut?: () => void },
) {
  const [shown, setShown] = useState<SettingShown>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setShown({ kind: "loading" });
    void port.read(documentId).then((read) => {
      if (!active) return;
      if (read.kind === "signedOut") onSignedOut?.();
      setShown(read.kind === "ready" ? read : { kind: read.kind });
    }).catch(() => { if (active) setShown({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [documentId, port, attempt, onSignedOut]);

  const change = async (enabled: boolean) => {
    if (submitted || busy) return;
    setBusy(true);
    setNote(text.saving);
    const result = await changeDirectEdit(port, documentId, enabled);
    setBusy(false);
    setNote(changeMessage(result, enabled));
    setShown((current) => afterChange(current, result));
    if (result.kind === "signedOut") onSignedOut?.();
  };

  if (shown.kind === "loading") return <p role="status">{text.loading}</p>;
  if (shown.kind !== "ready") {
    return (
      <section aria-label={text.title}>
        <p role="alert">{shown.kind === "signedOut" ? text.signedOut : text.unavailable}</p>
        {shown.kind === "unavailable" ? <Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button> : null}
      </section>
    );
  }
  return <DirectEditView state={shown.state} busy={busy} note={note} submitted={submitted} onChange={(next) => void change(next)} />;
}

/** The setting as the student's workspace mounts it: the real port, and sign-in again on 401. */
export function DirectEditSettingHost({ documentId, here, submitted = false }: { documentId: string; here: string; submitted?: boolean }) {
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  return <DirectEditSetting documentId={documentId} port={serverPort} submitted={submitted} onSignedOut={signedOut} />;
}
