"use client";

// WEB-NF6-RUNDA (NF-6 MK-9, odluka 8): what only the student sees, under the Mentor card of the student's
// own editor. "Poruka sebi" is the sealed note of WEB-NF6-SIFRA, mounted as it is (its sealing is not
// touched here); "Dokle sam stao" has no place on the server yet, so it says so instead of keeping it in
// the browser. The mentor's and teacher's views never mount this panel.
import type { ReactNode } from "react";

import type { NotePlace } from "../../../../../../src/client/sealed-self-note/codec";

import { SealedSelfNote } from "../sealed-self-note/SealedSelfNote";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.own;

export function OwnPanel({ documentId, currentPlace, onGoToPlace, note }: {
  documentId: string;
  currentPlace?: () => NotePlace | null;
  onGoToPlace?: (place: NotePlace) => void;
  /** For tests: the note itself is SealedSelfNote's own. */
  note?: ReactNode;
}) {
  return (
    <section aria-label={t.title} data-own-panel="">
      <h4>{t.title}</h4>
      <p>{t.intro}</p>
      {note ?? <SealedSelfNote documentId={documentId} currentPlace={currentPlace} onGoToPlace={onGoToPlace} />}
      <h5>{t.stopTitle}</h5>
      <p role="status">{t.stopUnavailable}</p>
    </section>
  );
}
