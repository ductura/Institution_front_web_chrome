"use client";

// WEB-NF6-RUNDA (NF-6 MK-9, odluka 8): what only the student sees, under the Mentor card of the student's
// own editor. "Poruka sebi" is the sealed note of WEB-NF6-SIFRA, mounted as it is (its sealing is not
// touched here). "Dokle sam stao" is the server's `readingPlace` (work.sealed-self-note.get): it is read and
// the student can go to it; the contract has no route to set it, so the panel says so and keeps nothing in
// the browser. The mentor's and teacher's views never mount this panel.
import { Button } from "@ductura/ui";
import { useState } from "react";
import type { ReactNode } from "react";

import type { NotePlace } from "../../../../../../src/client/sealed-self-note/codec";

import { SealedSelfNote } from "../sealed-self-note/SealedSelfNote";
import { dateText } from "./mentor-model";
import { mentorCardHr } from "./messages.hr";

/** `undefined` still reading; `null` a failed read; `{ place: null }` nothing kept yet. */
export type ReadingPlace = { readonly place: NotePlace | null; readonly updatedAt: string | null } | null | undefined;

const t = mentorCardHr.own;

export function OwnPanel({ documentId, currentPlace, onGoToPlace, reading, note }: {
  documentId: string;
  currentPlace?: () => NotePlace | null;
  /** Moves the editor to a place; false when the block is gone. */
  onGoToPlace?: (place: NotePlace) => boolean;
  reading: ReadingPlace;
  /** For tests: the note itself is SealedSelfNote's own. */
  note?: ReactNode;
}) {
  return (
    <section aria-label={t.title} data-own-panel="">
      <h4>{t.title}</h4>
      <p>{t.intro}</p>
      {note ?? <SealedSelfNote documentId={documentId} currentPlace={currentPlace} onGoToPlace={onGoToPlace && ((p) => { onGoToPlace(p); })} />}
      <h5>{t.stopTitle}</h5>
      <ReadingMark reading={reading} onGo={onGoToPlace} />
      <p>{t.stopCannotSet}</p>
    </section>
  );
}

function ReadingMark({ reading, onGo }: { reading: ReadingPlace; onGo?: (place: NotePlace) => boolean }) {
  const [gone, setGone] = useState(false);
  if (reading === undefined) return <p role="status">{t.stopLoading}</p>;
  if (reading === null) return <p role="alert">{t.stopUnavailable}</p>;
  const { place, updatedAt } = reading;
  if (place === null) return <p>{t.stopNone}</p>;
  return (
    <>
      <p>{t.stopKept.replace("{date}", updatedAt === null ? "" : dateText(updatedAt))}</p>
      {onGo && <Button size="dense" tone="secondary" onClick={() => setGone(!onGo(place))}>{t.stopGo}</Button>}
      {gone && <p role="alert">{t.stopGone}</p>}
    </>
  );
}
