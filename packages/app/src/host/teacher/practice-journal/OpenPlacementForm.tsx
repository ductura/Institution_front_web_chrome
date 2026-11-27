"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Select, TextField } from "@ductura/ui";

import { mentorJournalText as t } from "./messages.hr";
import { checkOpen, type OpenDraft, type OpenError } from "./model";
import type { OpenInput, OpenOutcome } from "./read";

const NOTE: Readonly<Record<Exclude<OpenOutcome["kind"], "opened" | "signedOut">, string>> = {
  notFound: t.openNotFound, invalid: t.openInvalid, unknown: t.openUnknown,
};
const EMPTY: OpenDraft = { mentorshipId: "", organisationName: "", startsOn: "", endsOn: "" };

/**
 * WEB-V19-DNEVNIK-MENTOR: "Otvori praksu" for one of the mentor's own mentorships. The checks are the
 * server's, repeated to spare a round trip; a note of success follows only the server's answer (B-6), and
 * the form stays locked while it is being sent. `open` does the write and `onChanged` reads the list again,
 * also after a refusal, since the server may know something the page did not.
 */
export function OpenPlacementForm({ mentorships, open, onChanged }: {
  mentorships: readonly { readonly mentorshipId: string; readonly name: string }[];
  open: (body: OpenInput) => Promise<OpenOutcome>;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<OpenDraft>(EMPTY);
  const [error, setError] = useState<{ field: string; error: OpenError } | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldError = (field: string) => (error?.field === field ? t.openErrors[error.error] : undefined);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkOpen(draft, mentorships.map((m) => m.mentorshipId));
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await open(checked.value);
    setBusy(false);
    if (outcome.kind === "signedOut") return;
    if (outcome.kind === "opened") {
      setNote({ tone: "status", text: t.opened });
      setDraft(EMPTY);
    } else {
      setNote({ tone: "alert", text: NOTE[outcome.kind] });
    }
    onChanged();
  }

  return (
    <Card level={2} title={t.openTitle}>
      <p>{t.openLead}</p>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <form onSubmit={(event) => void send(event)} noValidate>
        <Select label={t.fieldMentorship} disabled={busy} error={fieldError("mentorshipId")} value={draft.mentorshipId}
          options={[{ value: "", label: t.chooseMentorship }, ...mentorships.map((m) => ({ value: m.mentorshipId, label: m.name }))]}
          onChange={(e) => setDraft({ ...draft, mentorshipId: e.target.value })} />
        <TextField label={t.fieldOrganisation} hint={t.fieldOrganisationHint} busy={busy} value={draft.organisationName} error={fieldError("organisationName")}
          onChange={(e) => setDraft({ ...draft, organisationName: e.target.value })} />
        <TextField label={t.fieldStarts} type="date" busy={busy} value={draft.startsOn} error={fieldError("startsOn")}
          onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} />
        <TextField label={t.fieldEnds} type="date" busy={busy} value={draft.endsOn} min={draft.startsOn || undefined} error={fieldError("endsOn")}
          onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
        <p><Button type="submit" busy={busy}>{busy ? t.opening : t.openSubmit}</Button></p>
      </form>
    </Card>
  );
}
