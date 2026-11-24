"use client";

// WEB-NF6-RUNDA (NF-6 MK-9, odluka 8): what only the student sees, under the Mentor card of the student's
// own editor. "Poruka sebi" is the sealed note of WEB-NF6-SIFRA, mounted as it is (its sealing is not
// touched here). "Dokle sam stao" is the server's `readingPlace`: read with work.sealed-self-note.get, set
// and cleared with work.reading-place.put|delete (#631 review 2, point 1); the panel says it is saved only
// after the server answered, and keeps nothing in the browser. The mentor's and teacher's views never mount it.
import { Button } from "@ductura/ui";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { NotePlace } from "../../../../../../src/client/sealed-self-note/codec";

import { SealedSelfNote } from "../sealed-self-note/SealedSelfNote";
import { dateText } from "./mentor-model";
import { mentorCardHr } from "./messages.hr";

/** `undefined` still reading; `null` a failed read; `{ place: null }` nothing kept yet. */
export type ReadingPlace = { readonly place: NotePlace | null; readonly updatedAt: string | null } | null | undefined;
type Kept = NonNullable<ReadingPlace>;

/** A write of the reading place: the state the server answered with, or why there is none. */
export type ReadingWrite = { readonly kind: "ok"; readonly reading: Kept } | { readonly kind: "signedOut" | "failed" };
export type ReadingPort = { set(place: NotePlace): Promise<ReadingWrite>; clear(): Promise<ReadingWrite> };

const t = mentorCardHr.own;

export function OwnPanel({ documentId, currentPlace, onGoToPlace, reading, mark, note }: {
  documentId: string;
  currentPlace?: () => NotePlace | null;
  /** Moves the editor to a place; false when the block is gone. */
  onGoToPlace?: (place: NotePlace) => boolean;
  reading: ReadingPlace;
  /** Sets and clears the reading place; without it the mark is only read. */
  mark?: ReadingPort;
  /** For tests: the note itself is SealedSelfNote's own. */
  note?: ReactNode;
}) {
  return (
    <section aria-label={t.title} data-own-panel="">
      <h4>{t.title}</h4>
      <p>{t.intro}</p>
      {note ?? <SealedSelfNote documentId={documentId} currentPlace={currentPlace} onGoToPlace={onGoToPlace && ((p) => { onGoToPlace(p); })} />}
      <h5>{t.stopTitle}</h5>
      <ReadingMark reading={reading} onGo={onGoToPlace} mark={mark} here={currentPlace} />
    </section>
  );
}

function ReadingMark({ reading: given, onGo, mark, here }: {
  reading: ReadingPlace; onGo?: (place: NotePlace) => boolean; mark?: ReadingPort; here?: () => NotePlace | null;
}) {
  const [reading, setReading] = useState<ReadingPlace>(given);
  useEffect(() => setReading(given), [given]);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  if (reading === undefined) return <p role="status">{t.stopLoading}</p>;
  if (reading === null) return <p role="alert">{t.stopUnavailable}</p>;
  const { place, updatedAt } = reading;

  const write = async (run: () => Promise<ReadingWrite>, done: string) => {
    if (busy) return;
    setBusy(true); setNote(null); setGone(false);
    const outcome = await run().catch((): ReadingWrite => ({ kind: "failed" }));
    setBusy(false);
    if (outcome.kind === "ok") { setReading(outcome.reading); setNote({ ok: true, text: done }); return; }
    setNote({ ok: false, text: outcome.kind === "signedOut" ? t.stopSignedOut : t.stopFailed });
  };
  const setHere = () => {
    const at = here?.() ?? null;
    if (at === null) { setNote({ ok: false, text: t.stopNoPlace }); return; }
    void write(() => mark!.set(at), t.stopSaved);
  };

  return (
    <>
      {place === null ? <p>{t.stopNone}</p> : <p>{t.stopKept.replace("{date}", updatedAt === null ? "" : dateText(updatedAt))}</p>}
      <div>
        {place !== null && onGo && <Button size="dense" tone="secondary" onClick={() => setGone(!onGo(place))}>{t.stopGo}</Button>}
        {mark && here && <Button size="dense" tone="secondary" disabled={busy} onClick={setHere}>{busy ? t.stopSaving : t.stopSet}</Button>}
        {mark && place !== null && <Button size="dense" tone="quiet" disabled={busy} onClick={() => void write(() => mark.clear(), t.stopCleared)}>{t.stopClear}</Button>}
      </div>
      {gone && <p role="alert">{t.stopGone}</p>}
      {note !== null && <p role={note.ok ? "status" : "alert"}>{note.text}</p>}
    </>
  );
}
