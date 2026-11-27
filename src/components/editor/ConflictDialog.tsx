"use client";

/**
 * F4-EDI-R05: the author's decision when the server's work differs from the
 * text on this device (CONFLICT). A button in the notices opens a modal
 * dialog with the difference (this device's text against the server's) and
 * two choices:
 *
 * 1. "Uzmi verziju s poslužitelja": the local changes leave the work; the
 *    text of this device stays only as a copy on the device.
 * 2. "Zadrži tekst s ovog uređaja": a fresh version is taken from the server
 *    and this device's text is sent as a NEW commit on it, through the
 *    existing evidence route (`evidence.commit.post`). No new route.
 *
 * Both choices need the server's version, so they are offered only once it
 * was read; a failed read says so honestly and offers another try. Nothing
 * is written while the dialog only shows the difference.
 */
import { Button, Dialog, DiffView } from "@ductura/ui";
import { useEffect, useState } from "react";

import { messagesHr } from "@/lib/i18n/messages.hr";

import { conflictParts, documentText, type ConflictChoice, type ConflictOffer, type ConflictPart } from "./conflict-resolution";

const t = messagesHr.editor.conflictDialog;

type Shown =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; parts: ConflictPart[] };

export function ConflictDialog({ offer }: { offer: ConflictOffer }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<Shown>({ kind: "loading" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setShown({ kind: "loading" });
    void offer.serverVersion().then((server) => {
      if (!current) return;
      const local = offer.local();
      setShown(server && local
        ? { kind: "ready", parts: conflictParts(documentText(local), documentText(server)) }
        : { kind: "unavailable" });
    }).catch(() => { if (current) setShown({ kind: "unavailable" }); });
    return () => { current = false; };
  }, [open, attempt, offer]);

  const choose = async (choice: ConflictChoice) => {
    setWorking(true);
    setError(undefined);
    let outcome: Awaited<ReturnType<ConflictOffer["resolve"]>> = "unavailable";
    try {
      outcome = await offer.resolve(choice);
    } catch {
      outcome = "unavailable";
    }
    setWorking(false);
    if (outcome === "done") setOpen(false);
    else setError(outcome === "refused" ? t.refused : t.failed);
  };

  const ready = shown.kind === "ready";
  return (
    <>
      <button type="button" className="btn editor-conflict" onClick={() => { setError(undefined); setOpen(true); }}>
        {t.open}
      </button>
      <Dialog
        open={open}
        title={t.title}
        dismissible={!working}
        onClose={() => setOpen(false)}
        error={error}
        actions={(
          <>
            <Button onClick={() => void choose("server")} disabled={!ready || working}>{t.takeServer}</Button>
            <Button onClick={() => void choose("mine")} disabled={!ready || working}>{t.keepLocal}</Button>
            <Button onClick={() => setOpen(false)} disabled={working}>{t.cancel}</Button>
          </>
        )}
      >
        <p>{t.intro}</p>
        {shown.kind === "loading" ? <p role="status">{t.loading}</p> : null}
        {shown.kind === "unavailable" ? (
          <p role="alert">{t.unavailable} <Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
        ) : null}
        {shown.kind === "ready" ? (
          <>
            <p>{t.diffHeading}</p>
            <DiffView parts={shown.parts} />
            <p>{t.takeServerHelp}</p>
            <p>{t.keepLocalHelp}</p>
          </>
        ) : null}
        {working ? <p role="status">{t.working}</p> : null}
      </Dialog>
    </>
  );
}
