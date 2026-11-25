"use client";

// WEB-V13-UREDNIK: the speaker notes of the selected slide.
import { DraftField } from "./DraftField.tsx";
import { slidesEditorText } from "./messages.hr.ts";

export function NotesField({ notes, readOnly, onChange }: { notes: string | undefined; readOnly: boolean; onChange: (raw: string) => void }) {
  return <DraftField label={slidesEditorText.notesLabel} hint={slidesEditorText.notesHint} value={notes ?? ""} multiline readOnly={readOnly} onChange={onChange} />;
}
