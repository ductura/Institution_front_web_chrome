"use client";

// WEB-NF6-RUNDA (NF-6 MK-10, prototype prepMake / prepSend): "Složi iz rada" composes the preparation in the
// browser, the student edits it, then "Pošalji mentoru" (a message, confirmed by the server before it says
// so) or "Kopiraj". The note "zapis o unosu, ne o autorstvu" stays with the text.
import { ActionRow, Button, TextArea } from "@ductura/ui";
import { useState } from "react";

import { prepText } from "./mentor-model";
import { mentorCardHr } from "./messages.hr";
import { MAX_MESSAGE } from "./prep-model";
import type { PrepPort, SendOutcome } from "./prep-port";

const t = mentorCardHr.prep;

type Step = { kind: "empty" } | { kind: "making" } | { kind: "unavailable" } | { kind: "ready"; text: string };
type Note = { kind: "sent" | "copied" } | { kind: "error"; text: string } | null;

export function PrepPanel({ port, words, editable, onCopy }: {
  port: PrepPort; words: number | null;
  /** false after submission or for a reader: the preparation is only composed and copied, never sent. */
  editable: boolean;
  onCopy?: (text: string) => Promise<boolean>;
}) {
  const [step, setStep] = useState<Step>({ kind: "empty" });
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setStep({ kind: "making" }); setNote(null);
    const input = await port.compose(words).catch(() => null);
    setStep(input === null ? { kind: "unavailable" } : { kind: "ready", text: prepText(input) });
  };
  const send = async (text: string) => {
    if (busy) return;
    if (text.length > MAX_MESSAGE) { setNote({ kind: "error", text: t.tooLong.replace("{max}", String(MAX_MESSAGE)) }); return; }
    setBusy(true); setNote(null);
    const outcome: SendOutcome = await port.send(text).catch(() => "failed" as const);
    setBusy(false);
    setNote(outcome === "sent" ? { kind: "sent" } : { kind: "error", text: outcome === "signedOut" ? t.signedOut : t.sendFailed });
  };
  const copy = async (text: string) => {
    const ok = await (onCopy?.(text) ?? Promise.resolve(false)).catch(() => false);
    setNote(ok ? { kind: "copied" } : { kind: "error", text: t.copyFailed });
  };

  return (
    <div data-prep-panel="">
      <p>{t.intro}</p>
      <p>{t.note}</p>
      {step.kind === "empty" && <p role="status">{t.empty}</p>}
      {step.kind === "making" && <p role="status">{t.making}</p>}
      {step.kind === "unavailable" && <p role="alert">{t.unavailable}</p>}
      {step.kind === "ready" && (
        <>
          <TextArea label={t.edit} rows={9} value={step.text} readOnly={!editable}
            onChange={(e) => setStep({ kind: "ready", text: e.currentTarget.value })} />
          <ActionRow>
            {editable && <Button size="dense" disabled={busy || step.text.trim() === ""} onClick={() => void send(step.text)}>{busy ? t.sending : t.send}</Button>}
            {onCopy && <Button size="dense" tone="secondary" onClick={() => void copy(step.text)}>{t.copy}</Button>}
          </ActionRow>
        </>
      )}
      {step.kind !== "making" && (
        <Button size="dense" tone="quiet" onClick={() => void make()}>{step.kind === "ready" ? t.remake : t.make}</Button>
      )}
      {note?.kind === "sent" && <p role="status">{t.sent}</p>}
      {note?.kind === "copied" && <p role="status">{t.copied}</p>}
      {note?.kind === "error" && <p role="alert">{note.text}</p>}
    </div>
  );
}
