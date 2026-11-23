"use client";

import { Button, Card, DataTable, TextArea, TextField } from "@ductura/ui";
import { useEffect, useState } from "react";

import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { interviewMessages as text } from "./messages.hr";
import { appointmentLine, dateHr, failureMessage, isInvited, momentHr, orderedQuestions, pdfBytes, questionError, zagrebToIso } from "./model";
import type { InterviewOutcome, InterviewPreparation, InterviewQuestion, InterviewTeacherPort } from "./port";

type Props = {
  port: InterviewTeacherPort;
  documentId: string;
  workHref: string;
  summaryHref: string;
  /** Present only when the "Podrijetlo teksta" page exists (WEB-0911). */
  originHref?: string;
};

/**
 * N-14 "Priprema za razgovor" (WEB-1530): the teacher prepares a talk about the work. The page
 * shows the process summary link, the student's explanations, the questions (the student sees them
 * too), attachments and the appointment. It never records an outcome, grade, sanction or suspicion.
 */
export default function InterviewPage({ port, documentId, workHref, summaryHref, originHref }: Props) {
  const [prep, setPrep] = useState<InterviewPreparation | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [paragraph, setParagraph] = useState("");
  const [place, setPlace] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [heldDay, setHeldDay] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    void port.read(documentId).then((out) => {
      if (!live) return;
      if (out.kind === "ok") { setPrep(out.value); setFault(null); } else setFault(failureMessage(out));
    }).catch(() => { if (live) setFault(text.unavailable); });
    return () => { live = false; };
  }, [port, documentId, attempt]);

  const reload = () => { setPrep(null); setFault(null); setAttempt((n) => n + 1); };

  /** Success is shown only after the server confirms (B-6); the page then reads the state again. */
  const act = async (request: () => Promise<InterviewOutcome<unknown>>, after?: () => void) => {
    setNotice(null);
    const out = await request().catch((): InterviewOutcome<unknown> => ({ kind: "unavailable" }));
    if (out.kind === "ok") { after?.(); setNotice(text.saved); setAttempt((n) => n + 1); } else setNotice(failureMessage(out));
  };

  const download = async () => {
    setNotice(null);
    const out = await port.pdf(documentId).catch((): InterviewOutcome<never> => ({ kind: "unavailable" }));
    if (out.kind !== "ok") { setNotice(failureMessage(out)); return; }
    downloadBlob(new Blob([pdfBytes(out.value)], { type: "application/pdf" }), out.value.filename);
    setNotice(text.pdfReady);
  };

  const header = (
    <header>
      <a href={workHref}>{text.backToWork}</a>
      <h1>{text.title}</h1>
      <p>{text.notice}</p>
    </header>
  );

  if (fault !== null) {
    return (
      <div>{header}
        <p role="alert">{fault}</p>
        <Button tone="quiet" onClick={reload}>{text.retry}</Button>
      </div>
    );
  }
  if (prep === null) return <div>{header}<p role="status">{text.loading}</p></div>;

  const invited = isInvited(prep);
  const rows = orderedQuestions(prep.questions);
  const submitQuestion = () => {
    const error = questionError(question);
    if (error !== null) { setFormError(error); return; }
    setFormError(undefined);
    void act(() => port.addQuestion(documentId, { paragraphRef: paragraph.trim() === "" ? null : paragraph.trim(), questionText: question.trim() }),
      () => { setAdding(false); setQuestion(""); setParagraph(""); });
  };
  const submitAppointment = () => {
    const at = zagrebToIso(day, time);
    if (place.trim() === "" || at === null) { setNotice(text.appointmentFieldsEmpty); return; }
    void act(() => port.setAppointment(documentId, { place: place.trim(), at }));
  };

  return (
    <div>
      {header}
      <div>
        <Button tone="quiet" onClick={() => void download()}>{text.exportPdf}</Button>
        <Button disabled={invited} onClick={() => void act(() => port.invite(documentId))}>{text.invite}</Button>
      </div>
      <p>{invited && prep.invitedAt !== null ? text.invited(momentHr(prep.invitedAt)) : text.notInvited}</p>
      {notice !== null && <p role="status">{notice}</p>}

      <Card level={2} title={text.summaryTitle}>
        <p>{text.summaryNote}</p>
        <p><a href={summaryHref}>{text.summaryLink}</a></p>
        {originHref !== undefined && <p><a href={originHref}>{text.originLink}</a></p>}
      </Card>

      <Card level={2} title={text.explanationsTitle} empty={prep.explanations.length === 0 ? text.explanationsNone : undefined}>
        {prep.explanations.length > 0 && (
          <ul>
            {prep.explanations.map((e) => (
              <li key={e.id}>
                <strong>{e.questionId === null ? text.explanationGeneral : (prep.questions.find((q) => q.id === e.questionId)?.questionText ?? text.explanationGeneral)}</strong>
                <p>{e.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card level={2} title={text.partsTitle}>
        <DataTable<InterviewQuestion>
          caption={text.partsCaption}
          rowKey={(q) => q.id}
          rows={rows}
          empty={text.partsEmpty}
          columns={[
            { id: "paragraph", header: text.colParagraph, rowHeader: true, cell: (q) => q.paragraphRef ?? text.generalParagraph },
            { id: "how", header: text.colHow, cell: (q) => (q.mine ? text.howTeacher : text.howOther) },
            { id: "question", header: text.colQuestion, cell: (q) => q.questionText },
            { id: "remove", header: text.colRemove, cell: (q) => (q.mine
              ? <Button tone="quiet" onClick={() => void act(() => port.removeQuestion(documentId, q.id))}>{text.remove}</Button> : null) },
          ]}
        />
        <p>{text.studentSeesThem}</p>
        {adding ? (
          <div>
            <TextField label={text.paragraphLabel} hint={text.paragraphHint} value={paragraph} onChange={(e) => setParagraph(e.target.value)} />
            <TextArea label={text.questionLabel} value={question} error={formError} onChange={(e) => setQuestion(e.target.value)} />
            <Button onClick={submitQuestion}>{text.saveQuestion}</Button>
            <Button tone="quiet" onClick={() => { setAdding(false); setFormError(undefined); }}>{text.cancel}</Button>
          </div>
        ) : <Button tone="quiet" onClick={() => setAdding(true)}>{text.addQuestion}</Button>}
      </Card>

      <Card level={2} title={text.attachmentsTitle}>
        <p>{text.attachmentsNone}</p>
        <p>{text.attachmentsNote}</p>
      </Card>

      <Card level={2} title={text.appointmentTitle}>
        <p>{appointmentLine(prep)}</p>
        <TextField label={text.placeLabel} value={place} onChange={(e) => setPlace(e.target.value)} />
        <TextField label={text.atLabel} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <TextField label={`${text.atLabel} (hh:mm)`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Button onClick={submitAppointment}>{text.saveAppointment}</Button>
        {prep.heldOn !== null ? <p role="status">{text.heldOn(dateHr(prep.heldOn))}</p> : (
          <div>
            <TextField label={text.heldLabel} type="date" value={heldDay} onChange={(e) => setHeldDay(e.target.value)} />
            <Button disabled={!invited} onClick={() => (heldDay === "" ? setNotice(text.heldEmpty) : void act(() => port.markHeld(documentId, heldDay)))}>{text.markHeld}</Button>
          </div>
        )}
        <p>{text.outcomeNote}</p>
      </Card>
    </div>
  );
}
