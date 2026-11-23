"use client";

import { useEffect, useState } from "react";
import { Button, TextArea } from "@ductura/ui";

import { interviewMessages as text } from "./messages.hr";
import { afterAttach, afterSend, attachNote, canAttach, explanationError, orderedQuestions, sendExplanation, shownDate } from "./model";
import type { InterviewPort, InterviewRead } from "./port";

type Ready = Extract<InterviewRead, { kind: "ready" }>;

/**
 * Student's page for a teacher's invitation to a talk about the work (WEB-1531, PIL-K-RAZGOVOR). The
 * student sees the questions the server reveals to them and may write explanations; notes only while the
 * port has a route for them. The fixed notice says the talk is not an accusation; the page never shows an
 * outcome, grade or suspicion. Before the invitation the server answers 403, shown as "not yet scheduled".
 */
export default function StudentInterview({ port, documentId, onChooseSlot, onSignedOut, onNotFound, initial = null }: {
  port: InterviewPort; documentId: string; onChooseSlot?: () => void; onSignedOut?: () => void; onNotFound?: () => void;
  /** A read already in hand (the tests); the page then reads again only on retry. */
  initial?: InterviewRead | null;
}) {
  const [read, setRead] = useState<InterviewRead | null>(initial);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [attaching, setAttaching] = useState(false);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);

  useEffect(() => {
    if (attempt === 0 && initial !== null) return;
    let active = true;
    void port.read(documentId).then((next) => { if (active) setRead(next); }).catch(() => { if (active) setRead({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [port, documentId, attempt, initial]);

  useEffect(() => {
    if (read?.kind === "signedOut") onSignedOut?.();
    if (read?.kind === "notFound") onNotFound?.();
  }, [read, onSignedOut, onNotFound]);

  if (read === null || read.kind === "signedOut") return <p role="status">{text.loading}</p>;
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
    const next = afterSend(shown, result);
    setRead(next.read);
    setNotice({ tone: next.sent ? "status" : "alert", message: next.message });
    if (next.sent) setDrafts((d) => ({ ...d, [key]: "" }));
  };

  const attach = async (file: File | undefined) => {
    if (!file || attaching) return;
    setNotice(null);
    setAttaching(true);
    const result = await attachNote(port, documentId, file);
    setAttaching(false);
    if (result.kind === "invalid") { setFileError(result.message); return; }
    setFileError(undefined);
    if (result.kind === "signedOut") { onSignedOut?.(); return; }
    const next = afterAttach(shown, result);
    setRead(next.read);
    setNotice({ tone: next.saved ? "status" : "alert", message: next.message });
    // A held interview (409) ends the action: read the server's held state again.
    if (result.kind === "held") setAttempt((n) => n + 1);
  };

  const box = (key: string, questionId: string | null, label: string) => {
    const value = drafts[key] ?? "";
    const error = value.trim() === "" ? null : explanationError(value);
    return (
      <div>
        <TextArea label={label} value={value} error={error ?? undefined} invalid={error !== null} busy={pending === key}
          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
        <Button disabled={pending !== null || explanationError(value) !== null} onClick={() => void send(key, questionId)}>
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

      {port.attachNote !== undefined && canAttach(read) && (
        <>
          <label>
            {text.attachNote}
            <input type="file" accept=".pdf,.txt" disabled={attaching} aria-invalid={fileError ? true : undefined}
              onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <p>{text.attachNoteHint}</p>
          {attaching && <p role="status">{text.attaching}</p>}
          {fileError && <p role="alert">{fileError}</p>}
        </>
      )}
      {read.attachments.map((name) => <p key={name}>{text.attached}: {name}</p>)}
      {notice && <p role={notice.tone === "alert" ? "alert" : "status"}>{notice.message}</p>}
    </section>
  );
}
