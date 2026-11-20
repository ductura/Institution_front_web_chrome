"use client";

import { Button, DatePicker, Dialog, TextArea } from "@ductura/ui";
import { useState } from "react";

import { returnForRevisionHr as t } from "./messages.hr";
import { buildReturn, returnForRevision, type ReturnError, type ReturnOutcome, type ReturnPost } from "./return-for-revision";

const labels = {
  field: t.dueLabel, choose: t.dateChoose, previousMonth: t.datePrevious, nextMonth: t.dateNext, invalid: t.invalidDate,
  months: ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"], weekdays: ["pon", "uto", "sri", "čet", "pet", "sub", "ned"],
};

/** The dd-h dialog: instruction and optional deadline; nothing is sent while the text is empty. */
export default function ReturnForRevisionDialog({ documentId, today, post, open, onClose, onSent }: {
  documentId: string; today: string; post: ReturnPost; open: boolean; onClose: () => void; onSent: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnError | Exclude<ReturnOutcome, "ok"> | null>(null);

  const submit = async () => {
    if (busy) return;
    const built = buildReturn({ documentId, instruction, due, today });
    if (!built.ok) return setError(built.error);
    setBusy(true);
    const outcome = await returnForRevision(built.body, post);
    setBusy(false);
    if (outcome !== "ok") return setError(outcome);
    setError(null); setInstruction(""); setDue("");
    onSent();
  };

  return (
    <Dialog open={open} title={t.title} onClose={onClose} dismissible={!busy}
      error={error === null ? undefined : t.errors[error]}
      actions={<>
        <Button tone="quiet" onClick={onClose} disabled={busy}>{t.cancel}</Button>
        <Button onClick={() => void submit()} busy={busy}>{busy ? t.sending : t.send}</Button>
      </>}>
      <p>{t.note}</p>
      <TextArea label={t.instructionLabel} hint={t.instructionHint} value={instruction} busy={busy}
        onChange={(e) => setInstruction(e.target.value)} />
      <DatePicker value={due} onChange={setDue} labels={labels} min={today} today={today} />
      <p>{due === "" ? t.noDue : t.dueHint}</p>
    </Dialog>
  );
}
