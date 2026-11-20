"use client";

import { Button, Dialog, TextArea } from "@ductura/ui";
import { useState } from "react";

import { sendRevisionHr as t } from "./messages.hr";
import { buildSend, sendRevision, type SendOutcome, type SendSummary } from "./send-revision";

export default function SendRevisionDialog({ documentId, summary, post, open, onClose, onSent }: {
  documentId: string; summary: SendSummary; open: boolean; onClose: () => void; onSent: () => void;
  post: (body: { action: "send"; documentId: string; message: string }) => Promise<number | null>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"tooLong" | Exclude<SendOutcome, "ok"> | null>(null);

  const submit = async () => {
    if (busy) return;
    const built = buildSend(documentId, message);
    if (!built.ok) return setError(built.error);
    setBusy(true);
    const outcome = await sendRevision(built.body, post);
    setBusy(false);
    if (outcome !== "ok") return setError(outcome);
    setError(null); setMessage("");
    onSent();
  };

  return (
    <Dialog open={open} title={t.title} onClose={onClose} dismissible={!busy}
      error={error === null ? undefined : t.errors[error]}
      actions={<>
        <Button tone="quiet" onClick={onClose} disabled={busy}>{t.cancel}</Button>
        <Button onClick={() => void submit()} busy={busy}>{busy ? t.sending : t.send}</Button>
      </>}>
      <h3>{t.changedTitle}</h3>
      <ul>
        <li>{summary.textChanged ? t.textChanged : t.textSame}</li>
        <li>{t.resolved.replace("{n}", String(summary.resolved))}</li>
        <li>{t.open_.replace("{n}", String(summary.stillOpen))}</li>
      </ul>
      <TextArea label={t.messageLabel} hint={t.messageHint} value={message} busy={busy}
        onChange={(e) => setMessage(e.target.value)} />
      <p>{t.note}</p>
    </Dialog>
  );
}
