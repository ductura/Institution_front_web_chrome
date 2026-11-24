"use client";

// "Poruka sebi", sealed on the device (WEB-NF6-SIFRA, variant B2). Not mounted yet: the editor
// session mounts it in the assist panel in place of the old note (handoff in the PR). Props are
// the work, the place of the cursor when saving, and going to a kept place.

import { ActionRow, Button, Checkbox, Dialog, KeyValueList, Notice as Banner, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";
import type { NotePlace } from "@/client/sealed-self-note/codec";
import { forgetDeviceKey } from "@/client/sealed-self-note/device-key";
import { watchSessionEnd } from "@/client/session-end";
import { browserMarkStore, currentSession } from "@/client/session-marks";
import { sealedSelfNoteHr as t } from "./messages";
import {
  browserSelfNotePort, charsLeft, confirmRenew, confirmSetup, load, removeNote, reset, save, startRenew, startSetup, unlock,
  type Notice, type OpenView, type SaveError, type SelfNotePort, type View,
} from "./self-note-model";

export type SealedSelfNoteProps = {
  documentId: string;
  /** Where the cursor is in the work when the note is saved; null keeps no place. */
  currentPlace?: () => NotePlace | null;
  /** Moves the editor to a kept place. */
  onGoToPlace?: (place: NotePlace) => void;
  /** For tests and the catalogue. */
  port?: SelfNotePort;
};

export function SealedSelfNote({ documentId, currentPlace, onGoToPlace, port: given }: SealedSelfNoteProps) {
  const [port] = useState(() => given ?? browserSelfNotePort());
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setView({ kind: "loading" });
    void load(port, documentId).then((next) => { if (live) setView(next); }, () => { if (live) setView({ kind: "unavailable" }); });
    return () => { live = false; };
  }, [port, documentId, attempt]);

  // A sign-out anywhere in this browser removes the key from the device at once.
  useEffect(() => {
    const watch = watchSessionEnd(currentSession(browserMarkStore()), () => {
      void forgetDeviceKey();
      setView({ kind: "signedOut" });
    });
    return () => watch.close();
  }, []);

  const run = (step: Promise<View>) => step.then(setView, () => setView({ kind: "unavailable" }));

  return <section aria-label={t.title}>
    <p>{t.intro}</p>
    {view.kind === "loading" && <p role="status">{t.loading}</p>}
    {view.kind === "signedOut" && <p role="status">{t.signedOut}</p>}
    {view.kind === "notFound" && <p role="status">{t.notFound}</p>}
    {view.kind === "unavailable" && <>
      <p role="alert">{t.unavailable}</p>
      <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
    </>}
    {view.kind === "noKey" && <>
      {view.notice && <Banner tone="warn">{t[view.notice]}</Banner>}
      <p>{t.setupOffer}</p>
      <Button onClick={() => void run(startSetup(port))}>{t.setupStart}</Button>
    </>}
    {view.kind === "setup" && <Pair key={view.setup.body.keyId} phrase={view.setup.phrase} recovery={view.setup.recovery} notice={view.notice}
      onDone={() => run(confirmSetup(port, documentId, view.setup))} />}
    {view.kind === "locked" && <Locked view={view} port={port} documentId={documentId} onView={setView} />}
    {view.kind === "open" && <Open key={`${view.key.keyId}:${view.key.version}`} view={view} port={port} documentId={documentId}
      currentPlace={currentPlace} onGoToPlace={onGoToPlace} onView={setView} />}
    {view.kind === "renew" && <Pair key={view.setup.phrase} phrase={view.setup.phrase} recovery={view.setup.recovery} notice={view.notice}
      onDone={() => run(confirmRenew(port, documentId, view))} />}
  </section>;
}

/** The phrase and the recovery code, shown once, with the warning; "Gotovo" only after the box. */
function Pair({ phrase, recovery, notice, onDone }: { phrase: string; recovery: string; notice?: Notice; onDone: () => Promise<unknown> }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  return <div>
    <h3>{t.setupTitle}</h3>
    <p>{t.setupLead}</p>
    <KeyValueList items={[
      { id: "phrase", label: t.phraseLabel, value: <code>{phrase}</code> },
      { id: "recovery", label: t.recoveryLabel, value: <code>{recovery}</code> },
    ]} />
    <Banner tone="warn">{t.warning}</Banner>
    {notice && <p role="alert">{t[notice]}</p>}
    <Checkbox label={t.savedConfirm} checked={saved} onChange={(event) => setSaved(event.currentTarget.checked)} />
    <ActionRow>
      <Button disabled={!saved} busy={busy} onClick={() => { setBusy(true); void onDone().finally(() => setBusy(false)); }}>
        {busy ? t.setupBusy : t.setupDone}
      </Button>
    </ActionRow>
  </div>;
}

function Locked({ view, port, documentId, onView }: {
  view: Extract<View, { kind: "locked" }>; port: SelfNotePort; documentId: string; onView: (view: View) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"unlockWrong" | "unlockMalformed" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState(false);
  const stay = useRef<HTMLButtonElement>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await unlock(port, documentId, view.key, typed);
      if ("error" in result) setError(result.error);
      else { setTyped(""); onView(result.view); }
    } catch {
      onView({ kind: "unavailable" });
    } finally {
      setBusy(false);
    }
  };
  const startOver = async () => {
    setResetBusy(true);
    setResetError(false);
    try {
      const result = await reset(port, documentId, view.key);
      if ("error" in result) setResetError(true);
      else onView(result.view);
    } catch {
      setResetError(true);
    } finally {
      setResetBusy(false);
    }
  };

  return <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    {view.notice && <Banner tone="warn">{t[view.notice]}</Banner>}
    <p>{t.unlockLead}</p>
    <TextField label={t.unlockLabel} hint={t.unlockHint} value={typed} autoComplete="off" spellCheck={false} autoCapitalize="characters"
      onChange={(event) => setTyped(event.currentTarget.value)} error={error ? t[error] : undefined} busy={busy} />
    <ActionRow>
      <Button type="submit" busy={busy}>{busy ? t.unlockBusy : t.unlock}</Button>
      <Button type="button" tone="quiet" onClick={() => setConfirming(true)}>{t.lostBoth}</Button>
    </ActionRow>
    <Dialog open={confirming} title={t.resetTitle} onClose={() => { if (!resetBusy) setConfirming(false); }} dismissible={!resetBusy}
      initialFocus={stay} error={resetError ? t.resetFailed : undefined}
      actions={<>
        <Button ref={stay} tone="quiet" onClick={() => setConfirming(false)} disabled={resetBusy}>{t.resetCancel}</Button>
        <Button busy={resetBusy} onClick={() => void startOver()}>{resetBusy ? t.resetBusy : t.resetConfirm}</Button>
      </>}>
      <p>{t.resetBody}</p>
    </Dialog>
  </form>;
}

function Open({ view, port, documentId, currentPlace, onGoToPlace, onView }: {
  view: OpenView; port: SelfNotePort; documentId: string; currentPlace?: () => NotePlace | null;
  onGoToPlace?: (place: NotePlace) => void; onView: (view: View) => void;
}) {
  const [text, setText] = useState(view.note?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [typed, setTyped] = useState("");
  const [renewError, setRenewError] = useState<"unlockWrong" | "unlockMalformed" | null>(null);
  const left = charsLeft(text);
  const place = view.note?.place ?? null;

  const act = async (step: () => Promise<{ view: View } | { error: SaveError }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await step();
      if ("error" in result) setError(result.error);
      else onView(result.view);
    } catch {
      setError("saveFailed");
    } finally {
      setBusy(false);
    }
  };
  const renew = async () => {
    setBusy(true);
    setRenewError(null);
    try {
      const result = await startRenew(port, view, typed);
      if ("error" in result) setRenewError(result.error);
      else { setTyped(""); onView(result.view); }
    } catch {
      onView({ kind: "unavailable" });
    } finally {
      setBusy(false);
    }
  };

  return <div>
    {view.notice && view.notice !== "saved" && view.notice !== "removed" && <Banner tone={view.notice === "renewDone" ? "info" : "warn"}>{t[view.notice]}</Banner>}
    {view.old && <p>{t.oldNote}</p>}
    <TextArea label={t.noteLabel} value={text} rows={5} onChange={(event) => setText(event.currentTarget.value)}
      hint={t.noteHint(Math.max(left, 0))} error={left < 0 ? t.tooLong : error ? t[error] : undefined} busy={busy} />
    {place && <p>{t.placeKept}{" "}
      {onGoToPlace && <Button tone="quiet" onClick={() => onGoToPlace(place)}>{t.goToPlace}</Button>}
    </p>}
    <ActionRow>
      <Button busy={busy} disabled={left < 0 || text.length === 0} onClick={() => void act(() => save(port, documentId, view, text, currentPlace?.() ?? place))}>
        {busy ? t.saveBusy : t.save}
      </Button>
      {(view.note !== null || view.old) && <Button tone="quiet" disabled={busy} onClick={() => void act(() => removeNote(port, documentId, view))}>{t.remove}</Button>}
    </ActionRow>
    <p role="status">{view.notice === "saved" ? t.saved : view.notice === "removed" ? t.removed : ""}</p>
    {view.via === "recovery" && !renewing && <Button tone="quiet" onClick={() => setRenewing(true)}>{t.renewStart}</Button>}
    {renewing && <form onSubmit={(event) => { event.preventDefault(); void renew(); }}>
      <TextField label={t.renewLabel} hint={t.unlockHint} value={typed} autoComplete="off" spellCheck={false}
        onChange={(event) => setTyped(event.currentTarget.value)} error={renewError ? t[renewError] : undefined} busy={busy} />
      <ActionRow>
        <Button type="submit" busy={busy}>{t.renewConfirm}</Button>
        <Button type="button" tone="quiet" onClick={() => { setRenewing(false); setTyped(""); }}>{t.renewCancel}</Button>
      </ActionRow>
    </form>}
  </div>;
}
