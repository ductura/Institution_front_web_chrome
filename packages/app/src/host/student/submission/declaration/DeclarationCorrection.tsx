"use client";

// NF-3 PR-14 (E-9b, R-57, option b; PO-44, N-23): beside a declaration submitted with the work, the
// student may add a note to it, which the teacher sees with the summary; the confirmed declaration
// itself never changes. Withdrawing and submitting again stays the way to change it while the
// deadline runs (E-11b). The text waits for legal review, so the section carries that tag.
import { StepActions, StepPanel } from "@ductura/ui";
import { useState } from "react";

import type { SubmissionNote } from "../../../../../../../src/client/submission.ts";
import { saveNote } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import type { NoteAdded } from "../../../../../../../src/components/predaja/NoteDialog.tsx";
import { useOnline } from "../../../../../../../src/client/online-status.ts";
import StepLink from "../steps/StepLink";
import NoteForm from "../summary/NoteForm";
import { NOTES } from "../summary/notes-port";
import { correctionText as t } from "./messages.hr";

/**
 * Whether the section is shown at all (PR-14). The owner chose option (b) in the prototype; the text is
 * tagged for legal review, and this one constant hides the section if the review asks for that.
 */
export const DECLARATION_NOTE_AFTER_SUBMISSION = true;

export type DeclarationCorrectionProps = {
  readonly assignmentId: string;
  /** "Povlačenje predaje" on step 5. */
  readonly receiptHref: string;
  /** For tests; the page appends over student.submission-notes.post. */
  readonly add?: (assignmentId: string, text: string) => Promise<NoteAdded>;
};

const realAdd = (assignmentId: string, text: string) => saveNote(NOTES, assignmentId, text);

export default function DeclarationCorrection({ assignmentId, receiptHref, add = realAdd }: DeclarationCorrectionProps) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<readonly SubmissionNote[]>([]);
  if (!DECLARATION_NOTE_AFTER_SUBMISSION) return null;
  return (
    <StepPanel id="sb-correction-h" level={2} title={t.title} tag={t.tag}>
      <p className="meta">{t.legal}</p>
      <p className="note">{t.lead}</p>
      {added.length > 0 && (
        <>
          <p className="note" role="status">{t.added}</p>
          <ul className="facts">{added.map((note) => <li key={note.id}>{note.text}</li>)}</ul>
        </>
      )}
      {open
        ? (
          <NoteForm online={online} label={t.label} hint={t.hint} seenBy={t.seenBy}
            onAdd={(text) => add(assignmentId, text)}
            onAdded={(note) => { setAdded((list) => [...list, note]); setOpen(false); }}
            onCancel={() => setOpen(false)} />
        )
        : <StepActions><StepLink href="#sb-correction-h" onClick={() => setOpen(true)}>{t.open}</StepLink></StepActions>}
      <p className="note">{t.withdraw}</p>
      <StepLink href={receiptHref}>{t.toWithdraw}</StepLink>
    </StepPanel>
  );
}
