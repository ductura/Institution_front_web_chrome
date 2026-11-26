"use client";

import { Button, Dialog, Select, TextField } from "@ductura/ui";
import { useState } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { LATE_REASONS, lateDraft, recordLateException } from "./late-exception";
import { assignmentFactsMessages as text } from "./messages.hr";
import { whenHr } from "./model";

const l = text.late;
type Record = typeof recordLateException;
/** What the parent shows after an answer; `assignmentId` is set when the record may exist (a link to the list). */
export type LateResult = { tone: "status" | "alert"; text: string; assignmentId: string | null };

/**
 * "Dopusti predaju nakon roka…" (NZ-5, variant B) on the row of a student whose deadline passed without a submission:
 * a reason from the closed list and a new deadline; the server records it as an exception of its own for that one student.
 * The success note and the reload follow only the server's answer (B-6).
 */
export function LateException({ assignmentId, studentId, name, onResult, record = recordLateException, now = Date.now }: {
  assignmentId: string; studentId: string; name: string; onResult: (result: LateResult) => void; record?: Record; now?: () => number;
}) {
  const { base } = useHost();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    const checked = lateDraft({ studentId, reasonId, dueLocal }, now());
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    setError(null);
    const outcome = await record(createApi(), assignmentId, checked.draft);
    setBusy(false);
    if (outcome.kind === "session-expired") return goToSignIn(appHref(base, "/nastavnik"));
    if (outcome.kind === "zabiljezeno") {
      setOpen(false);
      setReasonId("");
      setDueLocal("");
      // The message goes to the parent: the row is mounted again once the facts are read again.
      onResult({ tone: "status", text: l.recorded(whenHr(outcome.exception.untilAt) ?? outcome.exception.untilAt), assignmentId: null });
    } else if (outcome.kind === "greska") setError(l.notRecorded);
    else { setOpen(false); onResult({ tone: "alert", text: l.unknown, assignmentId }); }
  }

  return (
    <>
      <button type="button" className="btn secondary small" aria-label={`${l.open} ${name}`} onClick={() => { setError(null); setOpen(true); }}>{l.open}</button>
      <Dialog open={open} title={`${l.title}: ${name}`} onClose={() => !busy && setOpen(false)} dismissible={!busy} error={error ?? undefined}
        actions={<>
          <Button type="button" disabled={busy} onClick={() => void submit()}>{l.record}</Button>
          <Button type="button" tone="secondary" disabled={busy} onClick={() => setOpen(false)}>{l.cancel}</Button>
        </>}>
        <p>{l.intro(name)}</p>
        <Select label={l.reason} value={reasonId} placeholder={l.reasonPlaceholder}
          options={LATE_REASONS.map((value) => ({ value, label: l.reasons[value] }))} onChange={(event) => setReasonId(event.target.value)} />
        <TextField label={l.due} type="datetime-local" value={dueLocal} onChange={(event) => setDueLocal(event.target.value)} />
        <p className="meta">{l.studentSees}</p>
      </Dialog>
    </>
  );
}
