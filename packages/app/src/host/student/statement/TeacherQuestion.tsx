"use client";

import { useEffect, useState } from "react";
import { Button, StepActions, StepEntry, StepSub, TextArea } from "@ductura/ui";

import type { StatementPort, StatementRead } from "../../../../../../src/client/statement.ts";
import { ANSWER_MAX_CHARS, answerAfterRead, checkAnswer, isReadOnly, saveAnswer, writeNotice } from "./model";
import { statementMessages } from "./messages.hr";

const q = statementMessages.question;
const withMax = (line: string) => line.replace("{max}", ANSWER_MAX_CHARS.toLocaleString("hr-HR"));

/**
 * NF-3 PR-20 (E-9, R-33): the teacher's question beside the declaration and the student's answer,
 * on the same read and session as the rest of the declaration step, so the answer is written on
 * the version the step read. The answer is not obligatory; without a question nothing is shown.
 * After submission the answer is read only. A failed write stays as an alert and keeps the text.
 */
export default function TeacherQuestion({ port, assignmentId, read, onReload, onSignIn }: {
  port: StatementPort;
  assignmentId: string;
  read: StatementRead | null;
  onReload: () => void;
  onSignIn: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (read !== null) setDraft((current) => answerAfterRead(current, read));
  }, [read]);

  if (read === null || read.kind !== "ready" || read.question === null) return null;
  const question = read.question;
  const held = read.answer !== null && read.answer.questionId === question.questionId ? read.answer : null;

  if (isReadOnly(read)) {
    return (
      <section aria-labelledby="tq-h" data-nf3="PR-20">
        <StepSub><span id="tq-h">{q.title}</span></StepSub>
        <p className="note">{question.text}</p>
        {held ? <StepEntry who={q.answer}>{held.text}</StepEntry> : <p className="meta">{q.noAnswer}</p>}
        <p className="meta">{q.readOnly}</p>
      </section>
    );
  }

  const text = draft ?? "";
  const check = checkAnswer(text);
  const error = check.kind === "tooLong" ? withMax(q.tooLong) : check.kind === "badCharacter" ? q.badCharacter : undefined;
  const unchanged = (check.kind === "ok" ? check.text : null) === (held?.text ?? null);

  const save = async () => {
    setSending(true);
    const result = await saveAnswer(port, assignmentId, read, text);
    setSending(false);
    if (result.kind === "invalid") return;
    if (result.kind === "signedOut") return onSignIn();
    if (result.kind === "saved") {
      setNotice({ tone: "status", message: check.kind === "empty" ? q.removed : q.saved });
      // The field shows what the server now holds.
      setDraft(null);
    } else {
      setNotice(writeNotice(result));
    }
    if (result.kind === "saved" || result.kind === "conflict") onReload();
  };

  return (
    <section aria-labelledby="tq-h" data-nf3="PR-20">
      <StepSub><span id="tq-h">{q.title}</span></StepSub>
      <p className="note">{question.text}</p>
      <TextArea label={q.answer} value={text} hint={withMax(q.hint)} error={error} rows={undefined}
        onChange={(event) => setDraft(event.currentTarget.value)} />
      <StepActions>
        <Button tone="secondary" disabled={sending || error !== undefined || unchanged} onClick={() => void save()}>
          {check.kind === "empty" && held ? q.remove : q.save}
        </Button>
      </StepActions>
      {notice && <p className="note" role={notice.tone === "alert" ? "alert" : "status"}>{notice.message}</p>}
    </section>
  );
}
