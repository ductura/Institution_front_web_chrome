"use client";

// WEB-NF6-ETAPE (NF-6 MK-6): "Primijeni predložak fakulteta" and "Dodaj etapu" beside the "Etape" card of one
// work on N-16 (prototype `m2-etape`). A note follows only the server's answer (B-6, 2164); after an
// unknown answer the dialog stays open with what was typed. `onChanged` reads the plan again.
import { Button, Dialog, Select, TextField } from "@ductura/ui";
import { useRef, useState } from "react";

import { zagrebInstant } from "../../../../../../src/lib/i18n/zagreb";
import { mentorPlanText } from "./messages.hr";
import { addStage, applyTemplate, planCall, type PlanCall, type PlanOutcome, type Submits } from "./plan-actions";

const t = mentorPlanText.plan;
type Note = { tone: "status" | "alert"; text: string };

/** The page's sentence for an outcome; `saved` names what was done. */
export function outcomeNote(outcome: PlanOutcome, saved: string): Note {
  switch (outcome) {
    case "saved": return { tone: "status", text: saved };
    case "conflict": return { tone: "alert", text: t.conflict };
    case "forbidden": return { tone: "alert", text: t.forbidden };
    case "notFound": return { tone: "alert", text: t.notFound };
    case "invalid": return { tone: "alert", text: t.invalid };
    default: return { tone: "alert", text: t.unknown };
  }
}

export function PlanActions({ documentId, onChanged, onSignedOut, call = planCall }: {
  documentId: string; onChanged: () => void; onSignedOut: () => void; call?: () => PlanCall;
}) {
  const [open, setOpen] = useState<"template" | "add" | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [submits, setSubmits] = useState<Submits>("current_version");
  const inFlight = useRef(false);

  const close = () => { if (!busy) { setOpen(null); setError(undefined); } };

  async function run(write: () => Promise<PlanOutcome>, saved: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    const outcome = await write();
    inFlight.current = false;
    setBusy(false);
    if (outcome === "signedOut") { onSignedOut(); return; }
    const said = outcomeNote(outcome, saved);
    if (outcome === "unknown" || outcome === "invalid") { setError(said.text); return; }
    setOpen(null);
    setNote(said);
    if (outcome === "saved") { setTitle(""); setDue(""); setSubmits("current_version"); }
    if (outcome === "saved" || outcome === "conflict") onChanged();
  }

  function add() {
    const name = title.trim();
    if (name === "") { setError(t.titleNeeded); return; }
    let dueAt: string | undefined;
    if (due !== "") {
      const instant = zagrebInstant(due);
      if (instant === null) { setError(t.dueInvalid); return; }
      dueAt = instant;
    }
    void run(() => addStage(call(), documentId, { title: name, dueAt, submits }), t.added);
  }

  return (
    <div>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <p>
        <Button tone="secondary" onClick={() => { setNote(null); setOpen("add"); }}>{t.add}</Button>{" "}
        <Button tone="quiet" onClick={() => { setNote(null); setOpen("template"); }}>{t.template}</Button>
      </p>
      {open === "template" && (
        <Dialog open title={t.templateTitle} error={error} dismissible={!busy} onClose={close}
          actions={<>
            <Button tone="quiet" disabled={busy} onClick={close}>{t.cancel}</Button>
            <Button busy={busy} disabled={busy} onClick={() => void run(() => applyTemplate(call(), documentId), t.applied)}>
              {busy ? t.saving : t.templateConfirm}
            </Button>
          </>}>
          <p>{t.templateBody}</p>
        </Dialog>
      )}
      {open === "add" && (
        <Dialog open title={t.addTitle} error={error} dismissible={!busy} onClose={close}
          actions={<>
            <Button tone="quiet" disabled={busy} onClick={close}>{t.cancel}</Button>
            <Button busy={busy} disabled={busy} onClick={add}>{busy ? t.saving : t.save}</Button>
          </>}>
          <TextField label={t.title} value={title} maxLength={200} required disabled={busy}
            onChange={(event) => { setTitle(event.target.value); setError(undefined); }} />
          <TextField label={t.due} type="datetime-local" value={due} hint={t.dueHint} disabled={busy}
            onChange={(event) => { setDue(event.target.value); setError(undefined); }} />
          <Select label={t.submits} value={submits} disabled={busy}
            options={(["current_version", "topic_text"] as const).map((value) => ({ value, label: t.submitsOptions[value] }))}
            onChange={(event) => setSubmits(event.target.value as Submits)} />
        </Dialog>
      )}
    </div>
  );
}
