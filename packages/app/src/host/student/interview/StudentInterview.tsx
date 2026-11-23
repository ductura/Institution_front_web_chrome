"use client";

import { useEffect, useState } from "react";
import { Button, TextArea } from "@ductura/ui";

import { interviewMessages as text } from "./messages.hr";
import { afterNote, afterSend, attachNote, explanationError, keepNotes, notesOpen, orderedQuestions, sendExplanation, shownDate } from "./model";
import { NOTE_FORMATS, type InterviewPort, type InterviewRead } from "./port";

type Ready = Extract<InterviewRead, { kind: "ready" }>;

/**
 * Student's page for a teacher's invitation to a talk about the work (WEB-1531, PIL-K-RAZGOVOR). The
 * student sees the questions the server reveals to them and may write explanations and attach notes
 * (work.interview-notes.post) until the talk is held; a note is listed only once the server confirms it. The fixed notice says the talk is not an accusation; the page never shows an
 * outcome, grade or suspicion. Before the invitation the server answers 403, shown as "not yet scheduled".
 */
export default function StudentInterview({ port, documentId, onChooseSlot, onSignedOut, onNotFound, initial = null }: {
  port: InterviewPort; documentId: string; onChooseSlot?: () => void; onSignedOut?: () => void; onNotFound?: () => void;
  /** A read already in hand (the tests); the page then reads again only on retry or after a 403 or 409. */
  initial?: InterviewRead | null;
}) {
  const [read, setRead] = useState<InterviewRead | null>(initial);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [notePending, setNotePending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);

  useEffect(() => {
    if (attempt === 0 && initial !== null) return;
    let active = true;
    void port.read(documentId).then((next) => { if (active) setRead((prev) => keepNotes(prev, next)); }).catch(() => { if (active) setRead({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [port, documentId, attempt, initial]);

  useEffect(() => {
    if (read?.kind === "signedOut") onSignedOut?.();
    if (read?.kind === "notFound") onNotFound?.();
  }, [read, onSignedOut, onNotFound]);

  if (read === null || read.kind === "signedOut" || read.kind === "notFound") return <p role="status">{text.loading}</p>;
  if (read.kind === "notInvited") return <p role="status">{text.notInvited}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{text.unavailable}</p>
        <Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>
      </div>
    );
  }

  const shown: Ready = read;
  const send = async (key: string, questionId: string | null) => {
    setPending(key);
    setNotice(null);
    const result = await sendExplanation(port, documentId, questionId, drafts[key] ?? "");
    setPending(null);
    if (result.kind === "signedOut") { onSignedOut?.(); return; }
    if (result.kind === "notFound") { onNotFound?.(); return; }
    // 403 on a send: read the talk again; a withdrawn invitation then shows as not scheduled, the draft stays.
    if (result.kind === "notInvited") setAttempt((n) => n + 1);
    const next = afterSend(shown, result);
    setRead(next.read);
    setNotice({ tone: next.sent ? "status" : "alert", message: next.message });
    if (next.sent) setDrafts((d) => ({ ...d, [key]: "" }));
  };

  const attach = async (file: File | undefined) => {
    if (!file || notePending) return;
    setNotePending(true);
    setNotice(null);
    const result = await attachNote(port, documentId, file);
    setNotePending(false);
    if (result.kind === "invalid") { setFileError(result.message); return; }
    setFileError(undefined);
    if (result.kind === "signedOut") { onSignedOut?.(); return; }
    if (result.kind === "notFound") { onNotFound?.(); return; }
    // 403: the invitation no longer holds; 409: the talk is held. Both read the talk again.
    if (result.kind === "notInvited" || result.kind === "closed") setAttempt((n) => n + 1);
    const next = afterNote(shown, result);
    if (next.closed) setClosed(true);
    setRead(next.read);
    setNotice({ tone: next.saved ? "status" : "alert", message: next.message });
  };

  const box = (key: string, questionId: string | null, label: string) => {
    const value = drafts[key] ?? "";
    const error = value.trim() === "" ? null : explanationError(value);
    return (
      <div>
        <TextArea label={label} value={value} error={error ?? undefined} invalid={error !== null} busy={pending === key}
          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
        <Button busy={pending !== null} disabled={explanationError(value) !== null} onClick={() => void send(key, questionId)}>
          {pending === key ? text.sending : text.send}
        </Button>
      </div>
    );
  };

  const slot = read.slot;
  return (
    <section aria-labelledby="interview-h">
      <h2 id="interview-h">{read.workTitle ? `${text.title} · ${read.workTitle}` : text.title}</h2>
      <p>{text.notice}</p>
      {read.heldAt && <p role="status">{text.heldNote.replace("{date}", shownDate(read.heldAt))}</p>}

      <h3>{text.slotTitle}</h3>
      <p>{slot ? `${text.slotAt}: ${[slot.place, shownDate(slot.at)].filter((part) => part !== "").join(" · ")}` : text.slotNone}</p>
      {onChooseSlot && <Button onClick={onChooseSlot}>{text.chooseSlot}</Button>}

      <h3>{text.questionsTitle}</h3>
      {read.questions.length === 0 ? <p>{text.noQuestions}</p> : (
        <ol>
          {orderedQuestions(read.questions).map((q) => (
            <li key={q.id}>
              <p><strong>{q.paragraphRef === null ? text.generalQuestion : text.paragraphQuestion}</strong>
                {q.paragraphExcerpt ? ` · ${q.paragraphExcerpt}` : ""}</p>
              <p>{q.text}</p>
              {read.explanations.filter((e) => e.questionId === q.id).map((e) => <p key={e.id}>{e.text}</p>)}
              {box(`q-${q.id}`, q.id, `${text.explanationLabel}: ${q.text}`)}
            </li>
          ))}
        </ol>
      )}

      <h3>{text.explanationsTitle}</h3>
      {read.explanations.filter((e) => e.questionId === null).map((e) => <p key={e.id}>{e.text}</p>)}
      {box("general", null, text.explanationGeneral)}

      {read.attachments.map((note) => <p key={note.id}>{text.attached}: {note.fileName}</p>)}
      {!closed && notesOpen(read, port) && (
        <>
          <label>
            {notePending ? text.noteSending : text.attachNote}
            <input type="file" accept={NOTE_FORMATS.join(",")} disabled={notePending} aria-invalid={fileError ? true : undefined}
              onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <p>{text.attachNoteHint}</p>
          {fileError && <p role="alert">{fileError}</p>}
        </>
      )}
      {/* Live regions present from the first render, so the outcome of a send is announced when written into them. */}
      <p role="status">{notice?.tone === "status" ? notice.message : ""}</p>
      <p role="alert">{notice?.tone === "alert" ? notice.message : ""}</p>
    </section>
  );
}
