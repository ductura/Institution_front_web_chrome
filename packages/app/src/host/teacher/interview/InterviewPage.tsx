"use client";

import { Button, Card, DataTable, Dialog, TextArea, TextField } from "@ductura/ui";
import { useEffect, useState } from "react";

import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft";
import { LoadAlert, NotFoundState } from "../../states/States";
import { interviewMessages as text } from "./messages.hr";
import { appointmentLine, dateHr, failureMessage, isInvited, momentHr, orderedQuestions, paragraphLabel, paragraphRefOf, pdfBytes, questionError, zagrebToIso } from "./model";
import type { InterviewOutcome, InterviewPreparation, InterviewQuestion, InterviewTeacherPort } from "./port";

type Fault = "unavailable" | "notFound" | "signedOut";
/** Where a message stands: under the invitation, under the questions or in the appointment card. */
type Scope = "invite" | "question" | "appointment";
type Notice = { readonly scope: Scope; readonly text: string };

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
  const [fault, setFault] = useState<Fault | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
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
      if (out.kind === "ok") { setPrep(out.value); setFault(null); } else setFault(out.kind === "signedOut" || out.kind === "notFound" ? out.kind : "unavailable");
    }).catch(() => { if (live) setFault("unavailable"); });
    return () => { live = false; };
  }, [port, documentId, attempt]);

  const reload = () => { setPrep(null); setFault(null); setAttempt((n) => n + 1); };

  /** Success is shown only after the server confirms (B-6); the page then reads the state again. */
  const act = async (scope: Scope, request: () => Promise<InterviewOutcome<unknown>>, after?: () => void) => {
    setNotice(null);
    const out = await request().catch((): InterviewOutcome<unknown> => ({ kind: "unavailable" }));
    if (out.kind === "ok") { after?.(); setNotice({ scope, text: text.saved }); setAttempt((n) => n + 1); return; }
    const message = failureMessage(out);
    setNotice(message === null ? null : { scope, text: message });
  };

  const download = async () => {
    setNotice(null);
    const out = await port.pdf(documentId).catch((): InterviewOutcome<never> => ({ kind: "unavailable" }));
    if (out.kind !== "ok") {
      const message = failureMessage(out);
      setNotice(message === null ? null : { scope: "invite", text: message });
      return;
    }
    downloadBlob(new Blob([pdfBytes(out.value)], { type: "application/pdf" }), out.value.filename);
    setNotice({ scope: "invite", text: text.pdfReady });
  };

  const header = (
    <header>
      <a href={workHref}>{text.backToWork}</a>
      <h1>{text.title}</h1>
      <p>{text.notice}</p>
    </header>
  );

  // 401: the shell leads to the AAI@EduHr sign-in, so the page says nothing. 404: "Stranica ne postoji".
  if (fault === "signedOut") return <div>{header}</div>;
  if (fault === "notFound") return <NotFoundState title={text.notFound} />;
  if (fault === "unavailable") {
    return (
      <div>{header}
        <LoadAlert body={text.unavailable} retry={{ label: text.retry, onRetry: reload }} />
      </div>
    );
  }
  if (prep === null) return <div>{header}<p role="status">{text.loading}</p></div>;

  const invited = isInvited(prep);
  const rows = orderedQuestions(prep.questions);
  const submitQuestion = () => {
    const error = questionError(question);
    const ref = paragraphRefOf(paragraph);
    if (error !== null) { setFormError(error); return; }
    if (!ref.ok) { setFormError(text.paragraphInvalid); return; }
    setFormError(undefined);
    void act("question", () => port.addQuestion(documentId, { paragraphRef: ref.value, questionText: question.trim() }),
      () => { setAdding(false); setQuestion(""); setParagraph(""); });
  };
  const submitAppointment = () => {
    const at = zagrebToIso(day, time);
    if (place.trim() === "" || at === null) { setNotice({ scope: "appointment", text: text.appointmentFieldsEmpty }); return; }
    void act("appointment", () => port.setAppointment(documentId, { place: place.trim(), at }));
  };

  return (
    <div>
      {header}
      <div>
        <Button tone="quiet" onClick={() => void download()}>{text.exportPdf}</Button>
        <Button disabled={invited} onClick={() => setConfirming(true)}>{text.invite}</Button>
      </div>
      <p>{invited && prep.invitedAt !== null ? text.invited(momentHr(prep.invitedAt)) : text.notInvited}</p>
      <Message notice={notice} scope="invite" />
      <Dialog open={confirming} title={text.confirmTitle} onClose={() => setConfirming(false)}
        actions={<>
          <Button tone="secondary" onClick={() => setConfirming(false)}>{text.cancel}</Button>
          <Button onClick={() => { setConfirming(false); void act("invite", () => port.invite(documentId)); }}>{text.confirmSend}</Button>
        </>}>
        <p>{text.confirmBody}</p>
      </Dialog>

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
            { id: "paragraph", header: text.colParagraph, rowHeader: true, cell: (q) => paragraphLabel(q.paragraphRef) },
            { id: "how", header: text.colHow, cell: (q) => (q.mine ? text.howTeacher : text.howOther) },
            { id: "question", header: text.colQuestion, cell: (q) => q.questionText },
            { id: "remove", header: text.colRemove, cell: (q) => (q.mine
              ? <Button tone="quiet" onClick={() => void act("question", () => port.removeQuestion(documentId, q.id))}>{text.remove}</Button> : null) },
          ]}
        />
        <p>{invited ? text.studentSeesThem : text.studentSeesThemLater}</p>
        {adding ? (
          <div>
            <TextField label={text.paragraphLabel} hint={text.paragraphHint} value={paragraph} onChange={(e) => setParagraph(e.target.value)} />
            <TextArea label={text.questionLabel} value={question} error={formError} onChange={(e) => setQuestion(e.target.value)} />
            <Button onClick={submitQuestion}>{text.saveQuestion}</Button>
            <Button tone="quiet" onClick={() => { setAdding(false); setFormError(undefined); }}>{text.cancel}</Button>
          </div>
        ) : <Button tone="quiet" onClick={() => setAdding(true)}>{text.addQuestion}</Button>}
        <Message notice={notice} scope="question" />
      </Card>

      <Card level={2} title={text.attachmentsTitle}>
        <p>{text.attachmentsNone}</p>
        <p>{text.attachmentsNote}</p>
      </Card>

      <Card level={2} title={text.appointmentTitle}>
        <p>{appointmentLine(prep)}</p>
        <TextField label={text.placeLabel} value={place} onChange={(e) => setPlace(e.target.value)} />
        <TextField label={text.dateLabel} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <TextField label={text.timeLabel} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Button onClick={submitAppointment}>{text.saveAppointment}</Button>
        {prep.heldOn !== null ? <p role="status">{text.heldOn(dateHr(prep.heldOn))}</p> : (
          <div>
            <TextField label={text.heldLabel} type="date" value={heldDay} onChange={(e) => setHeldDay(e.target.value)} />
            <Button disabled={!invited} onClick={() => (heldDay === "" ? setNotice({ scope: "appointment", text: text.heldEmpty }) : void act("appointment", () => port.markHeld(documentId, heldDay)))}>{text.markHeld}</Button>
          </div>
        )}
        <Message notice={notice} scope="appointment" />
        <p>{text.outcomeNote}</p>
      </Card>
    </div>
  );
}

/** A message from an action, shown under the button it belongs to (N-14). */
function Message({ notice, scope }: { notice: Notice | null; scope: Scope }) {
  return notice !== null && notice.scope === scope ? <p role="status">{notice.text}</p> : null;
}
