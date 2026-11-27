"use client";

// NZ-4 on the edit page: the switches of a published assignment, read from and saved to the server. The late rule
// (F4-NAS-R01) is a working choice once teacher.assignment-late-submission.get answers; otherwise it stays disabled.
// Saving after publication changes rules students have already seen, so the dialog dz-h asks first; the note
// "spremljeno" follows only the server's answer (B-6).
import { ActionRow, Button, Dialog, FormSection as Section } from "@ductura/ui";
import { useEffect, useMemo, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "@/components/shell/nav";

import { assignmentFormHr as f } from "../assignment-form/messages.hr";
import { readRules, setDeclarationRequired, setLateSubmission, setWithdrawal, type Call, type CurrentRules } from "../assignment-form/rules";
import { SubmissionRules } from "../assignment-form/SubmissionRules";
import { useHost } from "../../context";

const l = f.submitRules.live;
type Read = { kind: "ready"; rules: CurrentRules } | { kind: "signedOut" | "unavailable" };
type Note = { tone: "status" | "alert"; text: string };

export default function SubmissionRulesLive({ assignmentId, client }: { assignmentId: string; client?: Call }) {
  const { base } = useHost();
  // One client per mount: a new one on every render would make the read effect run again and again.
  const call = useMemo(() => client ?? (createApi() as Call), [client]);
  const [read, setRead] = useState<Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<CurrentRules | null>(null);
  const [edit, setEdit] = useState<CurrentRules | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const here = `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/uredi`;

  useEffect(() => {
    let live = true;
    void readRules(call, assignmentId).then((answer) => {
      if (!live) return;
      if (answer.kind === "signedOut") goToSignIn(appHref(base, here));
      setRead(answer);
      if (answer.kind === "ready") { setSaved(answer.rules); setEdit(answer.rules); }
    });
    return () => { live = false; };
  }, [call, assignmentId, attempt, base, here]);

  async function save() {
    if (edit === null || saved === null || busy) return;
    setBusy(true);
    setNote(null);
    // Only the switch that changed is sent; each one counts as set by the server's own answer.
    const outcomes = await Promise.all([
      edit.withdrawal !== saved.withdrawal ? setWithdrawal(call, assignmentId, edit.withdrawal) : Promise.resolve("set" as const),
      edit.declarationRequired !== saved.declarationRequired ? setDeclarationRequired(call, assignmentId, edit.declarationRequired) : Promise.resolve("set" as const),
      edit.lateAllowed !== undefined && edit.lateAllowed !== saved.lateAllowed ? setLateSubmission(call, assignmentId, edit.lateAllowed) : Promise.resolve("set" as const),
    ]);
    setBusy(false);
    setAsking(false);
    if (outcomes.includes("signedOut")) return goToSignIn(appHref(base, here));
    if (outcomes.every((outcome) => outcome === "set")) { setSaved(edit); setNote({ tone: "status", text: l.saved }); return; }
    // Read again: one switch may have been saved while the other was not.
    setNote({ tone: "alert", text: l.notSaved });
    setAttempt((n) => n + 1);
  }

  if (read === null) return <p role="status" className="meta">{l.loading}</p>;
  if (read.kind !== "ready" || edit === null || saved === null) {
    return (
      <section className="card" aria-labelledby="pr-live-h">
        <h2 id="pr-live-h">{l.heading}</h2>
        <p role="alert">{l.unavailable}</p>
        <Button type="button" tone="secondary" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{l.retry}</Button>
      </section>
    );
  }
  const changed = edit.withdrawal !== saved.withdrawal || edit.declarationRequired !== saved.declarationRequired || edit.lateAllowed !== saved.lateAllowed;
  return (
    // The section brings its own heading "Pravila predaje"; the wrapper is only the card.
    <div className="card">
      <Section id="zs-5" title={f.sections.submitRules}>
        <SubmissionRules prefix="live" value={edit} disabled={busy} onChange={(next) => { setNote(null); setEdit({ ...edit, ...next }); }} />
      </Section>
      {note ? <p className="note" role={note.tone === "alert" ? "alert" : "status"}>{note.text}</p> : null}
      <ActionRow>
        <Button type="button" disabled={!changed || busy} onClick={() => setAsking(true)}>{l.save}</Button>
      </ActionRow>
      <Dialog open={asking} title={l.confirmTitle} onClose={() => !busy && setAsking(false)} dismissible={!busy}
        actions={<>
          <Button type="button" disabled={busy} onClick={() => void save()}>{l.confirm}</Button>
          <Button type="button" tone="secondary" disabled={busy} onClick={() => setAsking(false)}>{l.cancel}</Button>
        </>}>
        <p>{l.confirmBody}</p>
      </Dialog>
    </div>
  );
}
