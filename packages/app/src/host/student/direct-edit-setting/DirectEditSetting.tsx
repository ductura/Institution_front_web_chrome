"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { changeDirectEdit, changeMessage, directEditBadge, type DirectEditPort, type DirectEditState } from "./model";
import { directEditSettingMessages as text } from "./messages.hr";

type Shown =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "signedOut" }
  | { kind: "ready"; state: DirectEditState };

/**
 * The student's work settings: allow or revoke the teacher's direct edits (WEB-1703; M6.4).
 * The mark below the switch is the one the teacher sees too. After a submission the setting
 * is fixed, so the buttons are off. A change shows as done only after the server names it.
 */
export default function DirectEditSetting(
  { assignmentId, port, submitted = false, onSignedOut }:
  { assignmentId: string; port: DirectEditPort; submitted?: boolean; onSignedOut?: () => void },
) {
  const [shown, setShown] = useState<Shown>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setShown({ kind: "loading" });
    void port.read(assignmentId).then((read) => {
      if (!active) return;
      if (read.kind === "signedOut") onSignedOut?.();
      setShown(read.kind === "ready" ? read : { kind: read.kind });
    }).catch(() => { if (active) setShown({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [assignmentId, port, attempt, onSignedOut]);

  const change = async (enabled: boolean) => {
    setBusy(true);
    setNote(text.saving);
    const result = await changeDirectEdit(port, assignmentId, enabled);
    setBusy(false);
    setNote(changeMessage(result, enabled));
    if (result.kind === "recorded") setShown({ kind: "ready", state: result.state });
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
  const { enabled } = shown.state;
  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      <p>{text.description}</p>
      <p data-direct-edit-badge={enabled ? "on" : "off"}>{directEditBadge(enabled)}</p>
      <Button disabled={busy || submitted} onClick={() => void change(!enabled)}>
        {enabled ? text.revoke : text.enable}
      </Button>
      {submitted ? <p>{text.submittedLocked}</p> : null}
      <p role="status" aria-live="polite">{note}</p>
    </section>
  );
}
