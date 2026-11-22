"use client";

import { Button, DatePicker, Dialog, TextArea } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import type { RevisionRequest } from "@/client/revision-requests";
import { zagrebWall } from "@/lib/i18n/zagreb";
import { readFrame } from "../n06/read";
import { TeacherToastRegion, toastWhenConfirmed, useTeacherToasts } from "../toast";
import { revisionMessages as t } from "./messages.hr";
import { bannerOf, buildRevision, type FormError } from "./model";
import { revisionPort, type ActionOutcome, type RevisionPort } from "./port";

const pad = (n: number) => String(n).padStart(2, "0");
function todayZagreb(): string {
  const w = zagrebWall(Date.now());
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}
const dateLabels = {
  field: t.dueLabel, choose: t.dateChoose, previousMonth: t.datePrevious, nextMonth: t.dateNext,
  invalid: t.invalidDate, months: [...t.months], weekdays: [...t.weekdays],
};

type Read = { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; requests: RevisionRequest[]; submitted: boolean };

/**
 * N-06 teacher's revision request (WEB-2151): "Zatraži doradu" for a submitted work, the dd-h dialog with a
 * mandatory deadline and the doradaBanner with its four states. Success toasts appear only after the server
 * confirmed (B-6); a failure stays as an inline `role="alert"`.
 */
export default function RevisionSection({ documentId, current, port = revisionPort }: {
  documentId: string; current: () => boolean; port?: RevisionPort;
}) {
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Exclude<ActionOutcome, "ok"> | null>(null);
  const toasts = useTeacherToasts();

  useEffect(() => {
    let live = true;
    void Promise.all([port.list(documentId, current), readFrame(documentId)]).then(([list, frame]) => {
      if (!live) return;
      setRead(list.kind !== "ok" ? { kind: "unavailable" } : {
        kind: "ready", requests: list.requests,
        submitted: frame.kind === "ready" && (frame.facts.state === "predano" || frame.facts.state === "nakon_roka"),
      });
    });
    return () => { live = false; };
  }, [documentId, port, current, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (read.kind === "loading") return <p role="status">{t.loading}</p>;
  if (read.kind === "unavailable") {
    return <div><p role="alert">{t.unavailable}</p><Button onClick={() => { setRead({ kind: "loading" }); reload(); }}>{t.retry}</Button></div>;
  }
  const banner = bannerOf(read.requests);
  const request = read.requests.find((r) => r.id === banner?.requestId);
  const act = async (run: () => Promise<ActionOutcome>, done: string) => {
    if (busy) return;
    setBusy(true); setFailure(null);
    const outcome = await toastWhenConfirmed(async () => { const o = await run(); return { ok: o === "ok", o }; }, toasts.show, done);
    setBusy(false);
    if (outcome.o === "ok") reload(); else setFailure(outcome.o);
  };
  return (
    <section aria-label={t.ask}>
      {banner !== null && (
        <div className="banner" role="status">
          <p><b>{banner.head}</b></p>
          <p className="note">„{banner.instruction}”</p>
          <p className="meta">{t.statesNote}</p>
          {banner.canClose && request && (
            <div className="acts">
              <Button disabled={busy} onClick={() => void act(() => port.accept(request), t.accepted)}>{t.accept}</Button>
              <Button tone="quiet" disabled={busy} onClick={() => void act(() => port.reopen(request), t.reopened)}>{t.reopen}</Button>
            </div>
          )}
        </div>
      )}
      {failure !== null && <p role="alert">{t.errors[failure]}</p>}
      {read.submitted && <Button onClick={() => setOpen(true)}>{t.ask}</Button>}
      {open && <AskDialog documentId={documentId} port={port} onClose={() => setOpen(false)}
        onSent={() => { setOpen(false); toasts.show(t.sent); reload(); }} />}
      <TeacherToastRegion toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </section>
  );
}

function AskDialog({ documentId, port, onClose, onSent }: {
  documentId: string; port: RevisionPort; onClose: () => void; onSent: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | Exclude<ActionOutcome, "ok"> | "sendUnavailable" | null>(null);
  const today = todayZagreb();
  const submit = async () => {
    if (busy) return;
    const built = buildRevision({ instruction, due, today });
    if (!built.ok) return setError(built.error);
    setBusy(true);
    const outcome = await port.create(documentId, built.body);
    setBusy(false);
    if (outcome === "ok") return onSent();
    setError(outcome === "unavailable" ? "sendUnavailable" : outcome);
  };
  const message = error === null ? undefined : error === "sendUnavailable" ? t.sendUnavailable : t.errors[error];
  return (
    <Dialog open title={t.title} onClose={onClose} dismissible={!busy} error={message}
      actions={<>
        <Button tone="quiet" onClick={onClose} disabled={busy}>{t.cancel}</Button>
        <Button onClick={() => void submit()} busy={busy}>{busy ? t.sending : t.send}</Button>
      </>}>
      <p>{t.explain}</p>
      <TextArea label={t.instructionLabel} value={instruction} busy={busy} onChange={(e) => setInstruction(e.target.value)} />
      <DatePicker value={due} onChange={setDue} labels={dateLabels} min={today} today={today} />
      <p>{t.dueHint}</p>
    </Dialog>
  );
}
