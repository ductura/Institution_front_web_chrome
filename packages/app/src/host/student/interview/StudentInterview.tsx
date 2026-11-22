"use client";

import { useEffect, useState } from "react";
import { Button, TextArea } from "@ductura/ui";

import { interviewMessages as text } from "./messages.hr";
import { attachNote, explanationError, orderedQuestions, sendExplanation } from "./model";
import type { InterviewPort, InterviewRead } from "./port";

/**
 * Student's page for a teacher's invitation to a talk about the work (WEB-1531). The student sees
 * the same questions as the teacher, may write explanations and attach notes. The fixed notice
 * says the talk is not an accusation; the page never shows an outcome, grade or suspicion.
 */
export default function StudentInterview({ port, documentId, onChooseSlot }: { port: InterviewPort; documentId: string; onChooseSlot?: () => void }) {
  const [read, setRead] = useState<InterviewRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | undefined>();
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void port.read(documentId).then((next) => { if (active) setRead(next); }).catch(() => { if (active) setRead({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [port, documentId, attempt]);

  if (read === null) return <p role="status">{text.loading}</p>;
  if (read.kind === "notInvited") return <p role="status">{text.notInvited}</p>;
  if (read.kind === "unavailable") {
    return (
      <div>
        <p role="alert">{text.unavailable}</p>
        <Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>
      </div>
    );
  }

  const send = async (key: string, questionId: string | null) => {
    const result = await sendExplanation(port, documentId, questionId, drafts[key] ?? "");
    if (result.kind === "saved") { setDrafts((d) => ({ ...d, [key]: "" })); setAttempt((n) => n + 1); }
    setNotice(result.kind === "saved" ? { tone: "status", message: text.sent }
      : { tone: "alert", message: result.kind === "rejected" ? text.rejected : text.failed });
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    const result = await attachNote(port, documentId, file);
    if (result.kind === "invalid") { setFileError(result.message); return; }
    setFileError(undefined);
    if (result.kind === "saved") setAttempt((n) => n + 1); else setNotice({ tone: "alert", message: text.failed });
  };

  const box = (key: string, questionId: string | null, label: string) => (
    <div>
      <TextArea label={label} value={drafts[key] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
      <Button disabled={explanationError(drafts[key] ?? "") !== null} onClick={() => void send(key, questionId)}>{text.send}</Button>
    </div>
  );

  return (
    <section aria-labelledby="interview-h">
      <h2 id="interview-h">{text.title} · {read.workTitle}</h2>
      <p>{text.notice}</p>
      {read.heldAt && <p role="status">{text.heldNote.replace("{date}", read.heldAt)}</p>}

      <h3>{text.slotTitle}</h3>
      <p>{read.slot ? `${text.slotAt}: ${read.slot.place} · ${read.slot.at}` : text.slotNone}</p>
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

      <label>
        {text.attachNote}
        <input type="file" accept=".pdf,.txt,.md" aria-invalid={fileError ? true : undefined}
          onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      <p>{text.attachNoteHint}</p>
      {read.attachments.map((name) => <p key={name}>{text.attached}: {name}</p>)}
      {fileError && <p role="alert">{fileError}</p>}
      {notice && <p role={notice.tone === "alert" ? "alert" : "status"}>{notice.message}</p>}
    </section>
  );
}
