"use client";

// WEB-V13-UREDNIK: the speaker notes of the selected slide.
import { DraftField } from "./DraftField.tsx";
import { slidesEditorText } from "./messages.hr.ts";

export function NotesField({ notes, readOnly, epoch, onChange }: { notes: string | undefined; readOnly: boolean; epoch: number; onChange: (raw: string) => void }) {
  return <DraftField label={slidesEditorText.notesLabel} hint={slidesEditorText.notesHint} value={notes ?? ""} multiline readOnly={readOnly} epoch={epoch} onChange={onChange} />;
}
