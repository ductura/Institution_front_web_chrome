"use client";

// N-16 (VIZ-N3): the card "Zahtjevi za mentorstvo" (`zm-h`) with "Odobri" and "Odbij" (dialog `do-h`) as in
// docs/prototip/Ductura_nastavnik.html. The decision logic is the unchanged `submitDecision` of
// src/components/teacher/MentorshipRequests; a note follows only the server's answer (B-6).
import { Button, Dialog, TextArea } from "@ductura/ui";
import { useState } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import { REASON_MAX, type Decision, type MentorshipCall, type MentorshipRequest } from "../../../../../../src/client/mentorship-requests";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";
import { submitDecision, type DecisionNote, type RequestsRead } from "../../../../../../src/components/teacher/MentorshipRequests";

const t = messagesHr.mentorshipRequests;
const workTypes: Record<string, string> = messagesHr.teacher.assignment.workTypes;

export function RequestsCard({ read, here, call, onDecided }: { read: RequestsRead; here: string; call: MentorshipCall | null; onDecided: () => void }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<{ id: string; decision: Decision } | null>(null);
  const [note, setNote] = useState<DecisionNote | null>(null);
  const [declining, setDeclining] = useState<MentorshipRequest | null>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function decide(request: MentorshipRequest, decision: Decision, text = "") {
    if (busy !== null) return;
    setNote(null);
    setDialogError(null);
    setBusy({ id: request.requestId, decision });
    const next = await submitDecision({ call, refresh: onDecided, signIn: () => goToSignIn(here) }, request, decision, text);
    setBusy(null);
    if (next === null) return;
    if (next.drop) {
      setGone((now) => new Set(now).add(request.requestId));
      setDeclining(null);
      setNote(next);
    } else if (declining !== null) setDialogError(next.text);
    else setNote(next);
  }

  if (read.kind === "unavailable") {
    return (
      <section className="card" aria-labelledby="zm-h">
        <h2 id="zm-h">{t.title}</h2>
        <p className="note" role="alert">{t.unavailable}</p>
        <div className="acts"><a className="btn secondary small" href={here}>{t.retry}</a></div>
      </section>
    );
  }
  const open = read.requests.filter((request) => !gone.has(request.requestId));
  return (
    <section className="card" aria-labelledby="zm-h">
      <h2 id="zm-h">{t.title}</h2>
      {note === null ? null : <p className="note" role={note.tone === "alert" ? "alert" : "status"}>{note.text}</p>}
      {open.length === 0 ? <p className="note">{t.empty}</p> : open.map((request) => {
        const name = request.studentName ?? t.unnamed;
        const mine = busy?.id === request.requestId;
        const type = workTypes[request.workType] ?? "";
        const sent = t.sentOn.replace("{date}", formatDateTimeHr(request.requestedAt));
        return (
          <div key={request.requestId} className="item">
            <span className="title">{name}</span>
            <span className="note">{type === "" ? sent : `${type}, ${sent}`}</span>
            <div className="acts">
              <Button size="small" busy={mine && busy?.decision === "approve"} disabled={busy !== null && !mine}
                aria-label={`${t.approve}: ${name}`} onClick={() => void decide(request, "approve")}>
                {mine && busy?.decision === "approve" ? t.approving : t.approve}
              </Button>
              <Button size="small" tone="secondary" disabled={busy !== null} aria-label={`${t.decline}: ${name}`}
                onClick={() => { setDeclining(request); setReason(""); setDialogError(null); }}>
                {t.decline}
              </Button>
            </div>
          </div>
        );
      })}
      <Dialog open={declining !== null} title={t.dialogTitle} onClose={() => { if (busy === null) setDeclining(null); }}
        dismissible={busy === null} error={dialogError ?? undefined}
        actions={(
          <>
            <Button tone="quiet" disabled={busy !== null} onClick={() => { if (busy === null) setDeclining(null); }}>{t.cancel}</Button>
            <Button busy={busy !== null} onClick={() => declining && void decide(declining, "decline", reason)}>
              {busy !== null ? t.declining : t.confirmDecline}
            </Button>
          </>
        )}>
        <p className="note">{declining ? [declining.studentName ?? t.unnamed, workTypes[declining.workType]].filter(Boolean).join(", ") : ""}</p>
        <TextArea label={t.reason} hint={t.reasonHint} maxLength={REASON_MAX} value={reason} busy={busy !== null}
          onChange={(event) => setReason(event.target.value)} />
      </Dialog>
    </section>
  );
}
