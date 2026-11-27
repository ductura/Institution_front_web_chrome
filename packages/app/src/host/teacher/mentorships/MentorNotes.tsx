"use client";

// MEN-R14 (MEN-38): "Radne bilješke" of one mentorship on N-16, visible only to the mentor (the server
// answers the mentor alone). It reads on its own: a failure says "unavailable" with a retry, never "none",
// and never hides the rest of the page. A note is added once and not edited; after the server's 201 the list
// is read again, so what is shown is what the server holds.
import { Button, Card, TextArea } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDateHr } from "@/lib/i18n/hr";
import { mentorNotesText as t } from "./messages.hr";
import { addNote, NOTE_MAX, readNotes, type NotesCall, type NotesRead, type NoteOutcome } from "./notes-port";

const said: Record<Exclude<NoteOutcome, "saved" | "signedOut">, string> = {
  invalid: t.invalid, forbidden: t.forbidden, notFound: t.notFound, unknown: t.unknown,
};

export function MentorNotes({ mentorshipId, name, call, onSignedOut }:
  { mentorshipId: string; name: string; call: () => NotesCall; onSignedOut?: () => void }) {
  const [read, setRead] = useState<NotesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    setRead(null);
    void readNotes(call(), mentorshipId).then((next) => {
      if (!live) return;
      setRead(next);
      if (next.kind === "signedOut") onSignedOut?.();
    });
    return () => { live = false; };
    // `call` is stable per mount; the attempt is what reads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorshipId, attempt]);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    setOk(false);
    if (text.trim() === "") { setError(t.needed); return; }
    if ([...text].length > NOTE_MAX) { setError(t.tooLong); return; }
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    const result = await addNote(call(), mentorshipId, text);
    inFlight.current = false;
    setBusy(false);
    if (result.outcome === "signedOut") { onSignedOut?.(); return; }
    if (result.outcome !== "saved") { setError(said[result.outcome]); return; }
    setText("");
    setOk(true);
    setAttempt((n) => n + 1);
  }, [text, call, mentorshipId, onSignedOut]);

  const retry = <Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>;
  return (
    <div data-testid="mentor-notes" data-state={read === null ? "loading" : read.kind}>
      <Card title={t.title(name)} busy={read === null}
        error={read?.kind === "unavailable" ? t.unavailable : read?.kind === "notFound" ? t.notFound : read?.kind === "signedOut" ? t.signedOut : undefined}>
        <p className="note">{t.lead}</p>
        {read?.kind === "ready" && (read.notes.length === 0 ? <p>{t.empty}</p> : (
          <ul>{read.notes.map((n) => (
            <li key={n.id}><span className="meta">{formatDateHr(n.createdAt)}</span><br />
              {n.body.split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</li>
          ))}</ul>
        ))}
        {read?.kind === "ready" && (
          <>
            {ok && <p role="status">{t.saved}</p>}
            <TextArea label={t.field} hint={t.hint} value={text} error={error} disabled={busy}
              onChange={(event) => { setText(event.currentTarget.value); setError(undefined); setOk(false); }} />
            {error === t.unknown && <p><Button tone="quiet" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>{t.refresh}</Button></p>}
            <p><Button busy={busy} disabled={busy} onClick={() => void save()}>{busy ? t.saving : t.add}</Button></p>
          </>
        )}
      </Card>
      {read?.kind === "unavailable" && <p>{retry}</p>}
    </div>
  );
}
